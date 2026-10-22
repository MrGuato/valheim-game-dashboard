// A tiny JSON writer, so neither mod needs a JSON library next to it in BepInEx/plugins.
using System.Globalization;
using System.Text;

namespace Longhouse
{
    internal sealed class Json
    {
        private readonly StringBuilder _sb = new StringBuilder();
        private bool _first = true;

        public Json() { _sb.Append('{'); }

        private Json Key(string key)
        {
            if (!_first) _sb.Append(',');
            _first = false;
            Quote(_sb, key);
            _sb.Append(':');
            return this;
        }

        public Json Str(string key, string value)
        {
            Key(key);
            if (value == null) _sb.Append("null"); else Quote(_sb, value);
            return this;
        }

        public Json Num(string key, double value)
        {
            Key(key);
            _sb.Append(double.IsNaN(value) || double.IsInfinity(value) ? "0" : value.ToString("0.##", CultureInfo.InvariantCulture));
            return this;
        }

        public Json Bool(string key, bool value)
        {
            Key(key);
            _sb.Append(value ? "true" : "false");
            return this;
        }

        public Json Obj(string key, Json value)
        {
            Key(key);
            _sb.Append(value.ToString());
            return this;
        }

        // already-serialized JSON, e.g. an array built with Arr
        public Json Raw(string key, string json)
        {
            Key(key);
            _sb.Append(json);
            return this;
        }

        public override string ToString() => _sb.ToString() + "}";

        // ["a",1] pairs: [["Greydwarf",3104],["Neck",1540]]
        public static string Pairs(System.Collections.Generic.IEnumerable<System.Collections.Generic.KeyValuePair<string, float>> pairs)
        {
            var sb = new StringBuilder("[");
            var first = true;
            foreach (var p in pairs)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append('[');
                Quote(sb, p.Key);
                sb.Append(',');
                sb.Append(p.Value.ToString("0.##", CultureInfo.InvariantCulture));
                sb.Append(']');
            }
            return sb.Append(']').ToString();
        }

        public static string Array(System.Collections.Generic.IEnumerable<Json> items)
        {
            var sb = new StringBuilder("[");
            var first = true;
            foreach (var j in items)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append(j.ToString());
            }
            return sb.Append(']').ToString();
        }

        private static void Quote(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4")); else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }
    }
}
