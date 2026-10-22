// Longhouse server plugin (Tier 1). Installed only on the dedicated server.
//
// Every few seconds it looks at the players connected to the server and writes one
// "LH1 {json}" line per player to the server log: biome, appearance, visible gear and
// health. The Longhouse collector already reads that log, so nothing new is exposed.
//
// It also relays stats sent by the opt-in companion mod (Tier 2). The player name is
// taken from the connection that sent them, so nobody can post stats for someone else.
using System;
using System.Collections.Generic;
using System.Text;
using BepInEx;
using BepInEx.Configuration;
using UnityEngine;

namespace Longhouse
{
    [BepInPlugin(Guid, "Longhouse Server", Version)]
    public class ServerPlugin : BaseUnityPlugin
    {
        public const string Guid = "com.mrguato.longhouse.server";
        public const string Version = "0.2.0";
        public const string StatsRpc = "Longhouse_Stats";

        private const int MaxPayloadChars = 48 * 1024;
        private const float MinStatsGapSeconds = 20f;
        private const float RepeatAfterSeconds = 300f; // unchanged players are re-sent this often

        private ConfigEntry<float> _scanSeconds;
        private ConfigEntry<bool> _acceptCompanion;

        private ZRoutedRpc _registeredOn;
        private float _nextScan;
        private readonly Dictionary<string, string> _lastLine = new Dictionary<string, string>();
        private readonly Dictionary<string, float> _lastLineAt = new Dictionary<string, float>();
        private readonly Dictionary<long, float> _lastStatsAt = new Dictionary<long, float>();

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
            _scanSeconds = Config.Bind("General", "ScanSeconds", 30f, "How often connected players are reported to the log (seconds, min 5).");
            _acceptCompanion = Config.Bind("General", "AcceptCompanionStats", true, "Relay stats sent by players who installed the Longhouse companion mod.");
            Logger.LogInfo($"Longhouse server plugin {Version} loaded");
        }

        private void Update()
        {
            var znet = ZNet.instance;
            if (znet == null || !znet.IsServer()) return;

            // a new ZRoutedRpc is created every time the world loads
            var rpc = ZRoutedRpc.instance;
            if (rpc != null && !ReferenceEquals(rpc, _registeredOn))
            {
                rpc.Register<string>(StatsRpc, OnCompanionStats);
                _registeredOn = rpc;
                _lastLine.Clear();
                Emit(new Json().Str("t", "hello").Str("plugin", Version));
            }

            if (Time.time < _nextScan) return;
            _nextScan = Time.time + Mathf.Max(5f, _scanSeconds.Value);
            foreach (var peer in znet.GetPeers())
            {
                try { ReportPeer(peer); }
                catch (Exception e) { Logger.LogWarning($"could not read player {peer?.m_playerName}: {e.Message}"); }
            }
        }

        private void ReportPeer(ZNetPeer peer)
        {
            if (peer == null || !peer.IsReady() || string.IsNullOrEmpty(peer.m_playerName)) return;

            var pos = peer.m_refPos;
            var zdo = peer.m_characterID.IsNone() || ZDOMan.instance == null ? null : ZDOMan.instance.GetZDO(peer.m_characterID);
            if (zdo != null) pos = zdo.GetPosition();

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

        private void OnCompanionStats(long sender, string payload)
        {
            if (!_acceptCompanion.Value || string.IsNullOrEmpty(payload) || payload.Length > MaxPayloadChars) return;
            var peer = ZNet.instance != null ? ZNet.instance.GetPeer(sender) : null;
            if (peer == null || string.IsNullOrEmpty(peer.m_playerName)) return;
            if (_lastStatsAt.TryGetValue(sender, out var last) && Time.time - last < MinStatsGapSeconds) return;
            _lastStatsAt[sender] = Time.time;

            // the payload is the player's JSON; base64 keeps whatever is in it on one log line
            var b64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payload));
            Emit(new Json().Str("t", "stats").Str("name", peer.m_playerName).Str("b64", b64));
        }

        private static void Emit(Json json) => Emit(json.ToString());

        // ZLog writes to the same server log Valheim uses, with the same timestamp prefix
        private static void Emit(string json) => ZLog.Log("LH1 " + json);

        private static string Vec(Vector3 v) => "[" + F(v.x) + "," + F(v.y) + "," + F(v.z) + "]";

        private static string F(float f) => Math.Round(f, 3).ToString(System.Globalization.CultureInfo.InvariantCulture);

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
            var token = drop != null ? drop.m_itemData.m_shared.m_name : null;
            if (string.IsNullOrEmpty(token)) return prefab.name;
            try
            {
                var text = Localization.instance != null ? Localization.instance.Localize(token) : token;
                return string.IsNullOrEmpty(text) || text.StartsWith("$") || text.StartsWith("[") ? prefab.name : text;
            }
            catch { return prefab.name; }
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
