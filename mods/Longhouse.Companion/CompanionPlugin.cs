// Longhouse companion mod (Tier 2). Opt-in, installed by a player on their own PC.
//
// Valheim keeps food, skills and lifetime stats on each player's machine. Once a minute
// this mod sends a read-only summary of them to the server over the game connection,
// where the Longhouse server plugin writes it to the log for the collector. No web
// requests, no tokens, and nothing in the game is changed.
//
// Note on achievements: Valheim 1.0 turns achievements off while Game.isModded is true,
// and the BepInExPack_Valheim loader sets it for every modded game. Iron Gate asks mods
// to set it too, so this one does. Uninstall BepInEx to earn achievements again.
using System;
using System.Collections.Generic;
using System.Linq;
using BepInEx;
using BepInEx.Configuration;
using UnityEngine;

namespace Longhouse
{
    [BepInPlugin(Guid, "Longhouse Companion", Version)]
    public class CompanionPlugin : BaseUnityPlugin
    {
        public const string Guid = "com.mrguato.longhouse.companion";
        public const string Version = "0.2.0";
        private const string StatsRpc = "Longhouse_Stats"; // matches ServerPlugin.StatsRpc
        private const int TopN = 40;

        private ConfigEntry<bool> _enabled;
        private ConfigEntry<float> _sendSeconds;
        private float _nextSend;

        private void Awake()
        {
            Game.isModded = true;
            _enabled = Config.Bind("General", "Enabled", true, "Send your food, skills and lifetime stats to the Longhouse dashboard of the server you're playing on.");
            _sendSeconds = Config.Bind("General", "SendSeconds", 60f, "How often to send (seconds, min 30).");
            Logger.LogInfo($"Longhouse companion {Version} loaded");
        }

        private void Update()
        {
            if (!_enabled.Value || Time.time < _nextSend) return;
            var player = Player.m_localPlayer;
            var znet = ZNet.instance;
            // only on a dedicated or hosted server we're a client of; a solo world has nobody to tell
            if (player == null || znet == null || znet.IsServer() || ZRoutedRpc.instance == null || Game.instance == null) return;
            var server = znet.GetServerPeer();
            if (server == null) return;
            _nextSend = Time.time + Mathf.Max(30f, _sendSeconds.Value);

            try
            {
                ZRoutedRpc.instance.InvokeRoutedRPC(server.m_uid, StatsRpc, BuildPayload(player, Game.instance.GetPlayerProfile()));
            }
            catch (Exception e)
            {
                Logger.LogWarning("could not send stats: " + e.Message);
            }
        }

        private static string BuildPayload(Player player, PlayerProfile profile)
        {
            // index 0 holds the raw lifetime stats, counted whether or not achievements are on
            var raw = profile.m_playerStats[0];
            float Stat(PlayerStatType t) => raw.m_stats.TryGetValue(t, out var v) ? v : 0f;

            var foods = player.GetFoods().Select(f => new Json()
                .Str("name", L(f.m_item.m_shared.m_name))
                .Num("minutesLeft", Math.Round(f.m_time / 60f))
                .Num("total", Math.Round(f.m_item.m_shared.m_foodBurnTime / 60f))
                .Str("kind", FoodKind(f.m_item.m_shared)));

            var skills = player.GetSkills().GetSkillList()
                .Where(s => s.m_level >= 1f)
                .OrderByDescending(s => s.m_level)
                .Select(s => new KeyValuePair<string, float>(L("$skill_" + s.m_info.m_skill.ToString().ToLower()), (float)Math.Floor(s.m_level)));

            return new Json()
                .Num("v", 1)
                .Str("mod", Version)
                .Obj("vitals", new Json()
                    .Raw("hp", Pair(player.GetHealth(), player.GetMaxHealth()))
                    .Raw("stamina", Pair(player.GetStamina(), player.GetMaxStamina()))
                    .Raw("eitr", Pair(player.GetEitr(), player.GetMaxEitr())))
                .Bool("rested", player.GetSEMan().HaveStatusEffect(SEMan.s_statusEffectRested))
                .Num("comfort", player.GetComfortLevel())
                .Raw("foods", Json.Array(foods))
                .Raw("skills", Json.Pairs(skills))
                .Obj("stats", new Json()
                    .Num("kills", Stat(PlayerStatType.EnemyKills) + Stat(PlayerStatType.BossKills))
                    .Num("bossKills", Stat(PlayerStatType.BossKills))
                    .Num("deaths", Stat(PlayerStatType.Deaths))
                    .Num("built", Stat(PlayerStatType.Builds))
                    .Num("crafted", Stat(PlayerStatType.Crafts) + Stat(PlayerStatType.Upgrades))
                    .Num("jumps", Stat(PlayerStatType.Jumps))
                    .Num("distanceKm", Math.Round(Stat(PlayerStatType.DistanceTraveled) / 1000f, 1))
                    .Num("treesChopped", Stat(PlayerStatType.Tree))
                    .Num("fishCaught", Stat(PlayerStatType.FishCaught)))
                .Raw("mobs", Json.Pairs(Top(raw.m_enemyStats[0])))
                .Raw("foodsEaten", Json.Pairs(Top(raw.m_foodEatenStats)))
                .Raw("materials", Json.Pairs(Top(raw.m_itemPickupStats)))
                .ToString();
        }

        // counters keyed by "$enemy_greydwarf" style tokens, localized and merged
        private static IEnumerable<KeyValuePair<string, float>> Top(Dictionary<string, float> counts) =>
            counts.Where(kv => kv.Value > 0)
                .GroupBy(kv => L(kv.Key), kv => kv.Value)
                .Select(g => new KeyValuePair<string, float>(g.Key, g.Sum()))
                .OrderByDescending(kv => kv.Value)
                .Take(TopN);

        private static string FoodKind(ItemDrop.ItemData.SharedData s)
        {
            if (s.m_foodEitr > s.m_food && s.m_foodEitr > s.m_foodStamina) return "eitr";
            return s.m_foodStamina > s.m_food ? "stamina" : "hp";
        }

        private static string Pair(float a, float b) => $"[{Mathf.RoundToInt(a)},{Mathf.RoundToInt(b)}]";

        private static string L(string token)
        {
            if (string.IsNullOrEmpty(token)) return "";
            try { return Localization.instance != null ? Localization.instance.Localize(token) : token; }
            catch { return token; }
        }
    }
}
