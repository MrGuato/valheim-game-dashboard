// Longhouse server plugin. Installed only on the dedicated server; players install nothing.
//
// It writes "LH1 {json}" lines to the server log, which the Longhouse collector already follows:
//   player  every 30 s per connected player: biome, look, visible gear, health
//   tally   kills per player and creature, from the "who hit this" marks Valheim keeps on creatures
//   pieces  every 10 min: building pieces each player has standing in the world
// It only reads state the server already has and never sends anything to players' games, so it
// can't affect anyone's achievements (those are decided on each player's own PC).
using System;
using System.Collections.Generic;
using System.Reflection;
using BepInEx;
using BepInEx.Configuration;
using UnityEngine;

namespace Longhouse
{
    [BepInPlugin(Guid, "Longhouse Server", Version)]
    public class ServerPlugin : BaseUnityPlugin
    {
        public const string Guid = "com.mrguato.longhouse.server";
        public const string Version = "0.3.1";

        private const float RepeatAfterSeconds = 300f; // unchanged players are re-sent this often

        private ConfigEntry<float> _scanSeconds;
        private ConfigEntry<float> _piecesMinutes;

        private ZNet _world;
        private ZDOMan _zdoMan;
        private float _nextScan, _nextPieces;
        private readonly Dictionary<string, string> _lastLine = new Dictionary<string, string>();
        private readonly Dictionary<string, float> _lastLineAt = new Dictionary<string, float>();
        private readonly Dictionary<string, Tally> _tallies = new Dictionary<string, Tally>();
        private readonly Dictionary<long, string> _builderNames = new Dictionary<long, string>();

        private sealed class Tally
        {
            public readonly Dictionary<string, int> Kills = new Dictionary<string, int>();
            public int Bosses;
        }

        private static readonly FieldInfo ObjectsById = typeof(ZDOMan).GetField("m_objectsByID", BindingFlags.Instance | BindingFlags.NonPublic);

        private static readonly (string slot, int item, int quality)[] Slots =
        {
            ("head", ZDOVars.s_helmetItem, 0),
            ("chest", ZDOVars.s_chestItem, 0),
            ("legs", ZDOVars.s_legItem, 0),
            ("cape", ZDOVars.s_shoulderItem, ZDOVars.s_shoulderItemQuality),
            ("weapon", ZDOVars.s_rightItem, ZDOVars.s_rightItemQuality),
            ("offhand", ZDOVars.s_leftItem, ZDOVars.s_leftItemQuality),
            ("utility", ZDOVars.s_utilityItem, 0)
        };

        private void Awake()
        {
            _scanSeconds = Config.Bind("General", "ScanSeconds", 30f, "How often connected players and kill tallies are written to the log (seconds, min 5).");
            _piecesMinutes = Config.Bind("General", "PiecesMinutes", 10f, "How often building pieces are counted per player (minutes, min 2). 0 turns it off.");
            Logger.LogInfo($"Longhouse server plugin {Version} loaded");
        }

        private void Update()
        {
            var znet = ZNet.instance;
            if (znet == null || !znet.IsServer() || ZDOMan.instance == null) return;

            if (!ReferenceEquals(znet, _world))
            {
                // a world was (re)loaded
                _world = znet;
                _lastLine.Clear();
                _tallies.Clear();
                Emit(new Json().Str("t", "hello").Str("plugin", Version));
                _nextPieces = Time.time + 60f; // let the world settle first
            }
            if (!ReferenceEquals(ZDOMan.instance, _zdoMan))
            {
                _zdoMan = ZDOMan.instance;
                _zdoMan.m_onZDODestroyed = (Action<ZDO>)Delegate.Combine(_zdoMan.m_onZDODestroyed, new Action<ZDO>(OnZdoDestroyed));
            }

            if (Time.time >= _nextScan)
            {
                _nextScan = Time.time + Mathf.Max(5f, _scanSeconds.Value);
                foreach (var peer in znet.GetPeers())
                {
                    try { ReportPeer(peer); }
                    catch (Exception e) { Logger.LogWarning($"could not read player {peer?.m_playerName}: {e.Message}"); }
                }
                FlushTallies();
            }

            if (_piecesMinutes.Value > 0 && Time.time >= _nextPieces)
            {
                _nextPieces = Time.time + Mathf.Max(2f, _piecesMinutes.Value) * 60f;
                try { CountPieces(); }
                catch (Exception e) { Logger.LogWarning("could not count pieces: " + e.Message); }
            }
        }

        // ---- players

        private void ReportPeer(ZNetPeer peer)
        {
            if (peer == null || !peer.IsReady() || string.IsNullOrEmpty(peer.m_playerName)) return;

            var pos = peer.m_refPos;
            var zdo = peer.m_characterID.IsNone() ? null : ZDOMan.instance.GetZDO(peer.m_characterID);
            if (zdo != null) pos = zdo.GetPosition();
            // the same id the game stamps on every piece this player builds (Piece.SetCreator)
            var playerId = zdo != null ? zdo.GetLong(ZDOVars.s_playerID) : 0L;
            if (playerId != 0 && !_builderNames.ContainsKey(playerId))
            {
                _builderNames[playerId] = peer.m_playerName;
                _nextPieces = Mathf.Min(_nextPieces, Time.time + 60f); // first count soon after someone new shows up
            }

            var line = new Json().Str("t", "player").Str("name", peer.m_playerName);
            // dungeons and other interiors sit far above the world
            if (pos.y > 3000f) line.Str("place", "dungeon");
            else if (WorldGenerator.instance != null) line.Str("biome", BiomeId(WorldGenerator.instance.GetBiome(pos)));

            if (zdo != null)
            {
                line.Obj("look", new Json()
                    .Num("model", zdo.GetInt(ZDOVars.s_modelIndex))
                    .Raw("skin", Vec(zdo.GetVec3(ZDOVars.s_skinColor, Vector3.one)))
                    .Raw("hair", Vec(zdo.GetVec3(ZDOVars.s_hairColor, Vector3.one)))
                    .Str("hairItem", PrefabName(zdo.GetInt(ZDOVars.s_hairItem)))
                    .Str("beardItem", PrefabName(zdo.GetInt(ZDOVars.s_beardItem))));

                var gear = new Json();
                foreach (var (slot, item, quality) in Slots)
                {
                    var hash = zdo.GetInt(item);
                    if (hash == 0) continue;
                    var g = new Json().Str("id", PrefabName(hash)).Str("name", ItemName(hash));
                    if (quality != 0) g.Num("q", Math.Max(1, zdo.GetInt(quality, 1)));
                    gear.Obj(slot, g);
                }
                line.Obj("gear", gear);

                var max = zdo.GetFloat(ZDOVars.s_maxHealth);
                if (max > 0) line.Raw("hp", $"[{Mathf.RoundToInt(zdo.GetFloat(ZDOVars.s_health, max))},{Mathf.RoundToInt(max)}]");
                if (zdo.GetBool(ZDOVars.s_inBed)) line.Bool("sleeping", true);
            }

            var text = line.ToString();
            var name = peer.m_playerName;
            if (_lastLine.TryGetValue(name, out var prev) && prev == text && Time.time - _lastLineAt[name] < RepeatAfterSeconds) return;
            _lastLine[name] = text;
            _lastLineAt[name] = Time.time;
            Emit(text);
        }

        // ---- kills

        // Valheim marks a creature with every player who hits it ("attackers" + name). When its
        // owner destroys it, the server is told, so a destroyed creature with marks was a kill.
        private void OnZdoDestroyed(ZDO zdo)
        {
            try
            {
                if (zdo == null || ZNetScene.instance == null || ZNet.instance == null || zdo.GetInt(ZDOVars.s_attackers) == 0) return;
                var prefab = ZNetScene.instance.GetPrefab(zdo.GetPrefab());
                if (prefab == null || prefab.GetComponent<Player>() != null) return;
                var creature = prefab.GetComponent<Character>();
                if (creature == null) return;
                var mob = Localize(creature.m_name, prefab.name);
                foreach (var peer in ZNet.instance.GetPeers())
                {
                    var name = peer.m_playerName;
                    if (string.IsNullOrEmpty(name) || !zdo.GetBool(ZDOVars.s_attackers + name)) continue;
                    if (!_tallies.TryGetValue(name, out var t)) _tallies[name] = t = new Tally();
                    t.Kills[mob] = (t.Kills.TryGetValue(mob, out var n) ? n : 0) + 1;
                    if (creature.m_boss) t.Bosses++;
                }
            }
            catch (Exception e)
            {
                Logger.LogWarning("kill tally: " + e.Message);
            }
        }

        private void FlushTallies()
        {
            foreach (var kv in _tallies)
            {
                var kills = new List<KeyValuePair<string, float>>();
                foreach (var k in kv.Value.Kills) kills.Add(new KeyValuePair<string, float>(k.Key, k.Value));
                Emit(new Json().Str("t", "tally").Str("name", kv.Key).Raw("kills", Json.Pairs(kills)).Num("bosses", kv.Value.Bosses));
            }
            _tallies.Clear();
        }

        // ---- building pieces

        private void CountPieces()
        {
            if (!(ObjectsById?.GetValue(ZDOMan.instance) is Dictionary<ZDOID, ZDO> all) || _builderNames.Count == 0) return;
            var counts = new Dictionary<long, int>();
            foreach (var zdo in all.Values)
            {
                var creator = zdo.GetLong(ZDOVars.s_creator);
                if (creator == 0 || !_builderNames.ContainsKey(creator)) continue;
                counts[creator] = (counts.TryGetValue(creator, out var n) ? n : 0) + 1;
            }
            var rows = new List<KeyValuePair<string, float>>();
            foreach (var kv in _builderNames) rows.Add(new KeyValuePair<string, float>(kv.Value, counts.TryGetValue(kv.Key, out var n) ? n : 0));
            Emit(new Json().Str("t", "pieces").Raw("counts", Json.Pairs(rows)));
        }

        // ---- helpers

        // ZLog writes to the same server log Valheim uses, with the same timestamp prefix
        private static void Emit(Json json) => Emit(json.ToString());
        private static void Emit(string json) => ZLog.Log("LH1 " + json);

        private static string Vec(Vector3 v) => "[" + F(v.x) + "," + F(v.y) + "," + F(v.z) + "]";
        private static string F(float f) => Math.Round(f, 3).ToString(System.Globalization.CultureInfo.InvariantCulture);

        // English text for a "$token", or the fallback when the server has none
        private static string Localize(string token, string fallback)
        {
            if (string.IsNullOrEmpty(token)) return fallback;
            try
            {
                var text = Localization.instance != null ? Localization.instance.Localize(token) : null;
                return string.IsNullOrEmpty(text) || text.StartsWith("$") || text.StartsWith("[") ? fallback : text;
            }
            catch { return fallback; }
        }

        private static string PrefabName(int hash)
        {
            if (hash == 0 || ObjectDB.instance == null) return null;
            var prefab = ObjectDB.instance.GetItemPrefab(hash);
            return prefab != null ? prefab.name : null;
        }

        private static string ItemName(int hash)
        {
            var prefab = ObjectDB.instance != null ? ObjectDB.instance.GetItemPrefab(hash) : null;
            if (prefab == null) return null;
            var drop = prefab.GetComponent<ItemDrop>();
            return Localize(drop != null ? drop.m_itemData.m_shared.m_name : null, prefab.name);
        }

        private static string BiomeId(Heightmap.Biome b)
        {
            switch (b)
            {
                case Heightmap.Biome.Meadows: return "meadows";
                case Heightmap.Biome.BlackForest: return "blackforest";
                case Heightmap.Biome.Swamp: return "swamp";
                case Heightmap.Biome.Mountain: return "mountain";
                case Heightmap.Biome.Plains: return "plains";
                case Heightmap.Biome.Mistlands: return "mistlands";
                case Heightmap.Biome.AshLands: return "ashlands";
                case Heightmap.Biome.DeepNorth: return "deepnorth";
                case Heightmap.Biome.Ocean: return "ocean";
                default: return null;
            }
        }
    }
}
