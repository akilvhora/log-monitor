// ---------------------------------------------------------------------------
// Level normalization
// ---------------------------------------------------------------------------

const LEVEL_MAP: Record<string, string> = {
  // DEBUG (includes Android Verbose + Trace)
  trace: "DEBUG", verbose: "DEBUG", v: "DEBUG",
  debug: "DEBUG", d: "DEBUG",
  "5": "DEBUG", "7": "DEBUG", "10": "DEBUG", "600": "DEBUG",
  // INFO
  info: "INFO", i: "INFO", information: "INFO", notice: "INFO",
  "6": "INFO", "20": "INFO",
  // WARN
  warn: "WARN", w: "WARN", warning: "WARN",
  "4": "WARN", "30": "WARN",
  // ERROR
  error: "ERROR", e: "ERROR", err: "ERROR",
  "3": "ERROR", "40": "ERROR",
  // FATAL
  fatal: "FATAL", f: "FATAL", critical: "FATAL", crit: "FATAL",
  emerg: "FATAL", alert: "FATAL",
  "2": "FATAL", "50": "FATAL", "60": "FATAL",
};

// Bunyan numeric range fallback
function bunyanNumeric(n: number): string | null {
  if (n <= 10) return "DEBUG";
  if (n <= 20) return "INFO";
  if (n <= 30) return "WARN";
  if (n <= 40) return "ERROR";
  return "FATAL";
}

export function normalizeLevel(raw: unknown): string | null {
  if (raw == null) return null;

  const str = String(raw).trim().toLowerCase();

  const num = Number(str);
  if (!isNaN(num) && isFinite(num)) {
    const byRange = bunyanNumeric(num);
    if (byRange) return byRange;
  }

  return LEVEL_MAP[str] ?? null;
}

// ---------------------------------------------------------------------------
// Timestamp parsing
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const PATTERNS: Array<{ re: RegExp; parse: (m: RegExpMatchArray) => Date | null }> = [
  // YYYY-MM-DD[T ]HH:mm:ss[.,mmm] — ISO 8601 / Hadoop / Zookeeper (comma ms)
  {
    re: /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?/,
    parse: (m) =>
      new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? "." + m[7] : ""}Z`),
  },

  // YY/MM/DD HH:mm:ss — Spark / Hadoop short-year (e.g. "17/06/09 20:10:40")
  {
    re: /^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
    parse: (m) =>
      new Date(Date.UTC(2000 + parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
        parseInt(m[4]), parseInt(m[5]), parseInt(m[6]))),
  },

  // YYYYMMDD-HH:MM:SS[:mmm] — HealthApp (e.g. "20171223-22:15:29:606")
  {
    re: /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?::(\d+))?/,
    parse: (m) =>
      new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
        parseInt(m[4]), parseInt(m[5]), parseInt(m[6]), parseInt(m[7] ?? "0"))),
  },

  // YYMMDD HHMMSS — HDFS (no separators, e.g. "081109 203615")
  {
    re: /^(\d{2})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})/,
    parse: (m) =>
      new Date(Date.UTC(2000 + parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
        parseInt(m[4]), parseInt(m[5]), parseInt(m[6]))),
  },

  // MM-DD HH:mm:ss[.mmm] — Android logcat (no year, e.g. "03-17 16:13:38.811")
  {
    re: /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
    parse: (m) => {
      const year = new Date().getFullYear();
      return new Date(Date.UTC(year, parseInt(m[1]) - 1, parseInt(m[2]),
        parseInt(m[3]), parseInt(m[4]), parseInt(m[5])));
    },
  },

  // MM.DD HH:mm:ss — Proxifier (no year, e.g. "10.30 16:49:06")
  {
    re: /^(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
    parse: (m) => {
      const year = new Date().getFullYear();
      return new Date(Date.UTC(year, parseInt(m[1]) - 1, parseInt(m[2]),
        parseInt(m[3]), parseInt(m[4]), parseInt(m[5])));
    },
  },

  // Day Mon [D]D HH:mm:ss YYYY — Apache (e.g. "Sun Dec 04 04:47:44 2005")
  {
    re: /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})/,
    parse: (m) => {
      const month = MONTH_MAP[m[1].toLowerCase()];
      if (month === undefined) return null;
      return new Date(Date.UTC(parseInt(m[6]), month, parseInt(m[2]),
        parseInt(m[3]), parseInt(m[4]), parseInt(m[5])));
    },
  },

  // MMM [D]D HH:mm:ss — syslog RFC 3164, no year (e.g. "Jan  4 15:16:01")
  {
    re: /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/,
    parse: (m) => {
      const month = MONTH_MAP[m[1].toLowerCase()];
      if (month === undefined) return null;
      return new Date(Date.UTC(new Date().getFullYear(), month, parseInt(m[2]),
        parseInt(m[3]), parseInt(m[4]), parseInt(m[5])));
    },
  },

  // dd/MMM/yyyy:HH:mm:ss ±hhmm — NCSA combined log
  {
    re: /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})/,
    parse: (m) => {
      const month = MONTH_MAP[m[2].toLowerCase()];
      if (month === undefined) return null;
      const tz = m[7];
      const tzSign = tz[0] === "+" ? 1 : -1;
      const offsetMs = tzSign * (parseInt(tz.slice(1, 3)) * 60 + parseInt(tz.slice(3, 5))) * 60_000;
      return new Date(Date.UTC(parseInt(m[3]), month, parseInt(m[1]),
        parseInt(m[4]), parseInt(m[5]), parseInt(m[6])) - offsetMs);
    },
  },
];

export function parseTimestamp(raw: unknown): { date: Date; warn: boolean } {
  if (raw == null || raw === "") return { date: new Date(), warn: true };

  // Numeric epoch (BGL / HPC / Thunderbird pass unix seconds as string)
  const num = Number(raw);
  if (!isNaN(num) && isFinite(num) && num > 0) {
    return { date: new Date(num > 1e12 ? num : num * 1000), warn: false };
  }

  const str = String(raw).trim();

  // Try native Date (handles full ISO 8601, RFC 2822, many common variants)
  const native = new Date(str);
  if (!isNaN(native.getTime())) {
    return { date: native, warn: false };
  }

  // Explicit pattern matching
  for (const { re, parse } of PATTERNS) {
    const m = str.match(re);
    if (m) {
      const d = parse(m);
      if (d && !isNaN(d.getTime())) return { date: d, warn: false };
    }
  }

  return { date: new Date(), warn: true };
}
