import type { ParseResult, RawRow } from "./types.js";

// ---------------------------------------------------------------------------
// Patterns — ordered most-specific → least-specific
// ---------------------------------------------------------------------------

// OpenStack: "nova-api.log.1.2017-05-16_13:53:08 YYYY-MM-DD HH:MM:SS.mmm PID LEVEL component message"
const PATTERN_OPENSTACK =
  /^(\S+\.log\S*)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+\d+\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|NOTICE|TRACE)\s+(\S+)\s+(.+)$/i;

// BGL: "- epoch YYYY.MM.DD node datetime node comp comp LEVEL message"
const PATTERN_BGL =
  /^-\s+(\d+)\s+\d{4}\.\d{2}\.\d{2}\s+(\S+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\s+(.+)$/i;

// Thunderbird: "- epoch YYYY.MM.DD node Mon DD HH:MM:SS host/host service[pid]: message"
const PATTERN_THUNDERBIRD =
  /^-\s+(\d+)\s+\d{4}\.\d{2}\.\d{2}\s+(\S+)\s+[A-Za-z]{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\S+\s+([^\s(\[]+?)(?:\([^)]*\))?(?:\[\d+\])?:\s+(.+)$/;

// Windows CBS: "YYYY-MM-DD HH:MM:SS, Level  Component  message"
const PATTERN_WINDOWS =
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}),\s+(Info|Warning|Error|Verbose|Critical)\s+(\S+)\s+(.+)$/i;

// Zookeeper: "YYYY-MM-DD HH:MM:SS,mmm - LEVEL  [thread] - message"
const PATTERN_ZOOKEEPER =
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d+)\s+-\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\s+\[(.+)\]\s+-\s+(.+)$/i;

// Hadoop: "YYYY-MM-DD HH:MM:SS,mmm LEVEL [thread] component: message"
const PATTERN_HADOOP =
  /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d+)\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\s+\[[^\]]+\]\s+(\S+):\s+(.+)$/i;

// Pattern A (general ISO): "YYYY-MM-DD[T ]HH:MM:SS LEVEL [service] message"
const PATTERN_A =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL|NOTICE|TRACE|VERBOSE)\s+(?:\[([^\]]+)\]\s*:?\s*)?(.+)$/i;

// Android logcat: "MM-DD HH:MM:SS.mmm  PID  TID D component: message"
const PATTERN_ANDROID =
  /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s+\d+\s+\d+\s+([DVIWEFSF])\s+([^:]+):\s+(.+)$/;

// Apache httpd: "[Day Mon DD HH:MM:SS YYYY] [level] message"
const PATTERN_APACHE =
  /^\[([A-Za-z]{3} [A-Za-z]{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\]\s+\[(\w+)\]\s+(.+)$/;

// Syslog (Linux / Mac / OpenSSH): "Mon DD HH:MM:SS host service[pid]: message"
const PATTERN_SYSLOG =
  /^([A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^[\s]+?)(?:\[\d+\])?:\s+(.+)$/;

// Bracketed ISO timestamp: "[timestamp] LEVEL service: message"
const PATTERN_BRACKETED =
  /^\[([^\]]+)\]\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL|TRACE)\s+([^:]+):\s+(.+)$/i;

// Proxifier: "[MM.DD HH:MM:SS] app.exe - message"
const PATTERN_PROXIFIER =
  /^\[(\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\]\s+(\S+)\s+-\s+(.+)$/;

// HDFS: "YYMMDD HHMMSS thread LEVEL component: message"
const PATTERN_HDFS =
  /^(\d{6})\s+(\d{6})\s+\d+\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\s+([^:]+):\s+(.+)$/i;

// HealthApp: "YYYYMMDD-HH:MM:SS:mmm|component|pid|message"
const PATTERN_HEALTHAPP =
  /^(\d{8}-\d{2}:\d{2}:\d{2}:\d+)\|([^|]+)\|\d+\|(.+)$/;

// HPC cluster: "jobid node event_type unix_epoch count message"
const PATTERN_HPC =
  /^\d+\s+(\S+)\s+\S+\s+(\S+)\s+(\d{9,10})\s+\d+\s+(.+)$/;

// Spark / Hadoop short-year: "YY/MM/DD HH:MM:SS LEVEL component: message"
const PATTERN_SPARK =
  /^(\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\s+(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\s+([^:]+):\s+(.+)$/i;

// Level-first: "ERROR [service] message" or "ERROR: message"
const PATTERN_LEVEL_FIRST =
  /^(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL|TRACE|VERBOSE)\s*:?\s*(?:\[([^\]]+)\]\s+)?(.+)$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a readable class name from a Zookeeper thread string like
 *  "QuorumPeer[myid=1]/0:0:0:0:0:0:0:0:2181:FastLeaderElection@774" */
function extractZkClass(thread: string): string {
  const beforeAt = thread.split("@")[0];
  const parts = beforeAt.split(/[/:]/).reverse();
  return parts.find((p) => /^[A-Z]/.test(p)) ?? thread;
}

/** Map HPC event type to a log level. */
function hpcEventLevel(event: string): string {
  const lower = event.toLowerCase();
  if (lower.includes("error") || lower.includes("fatal")) return "ERROR";
  if (lower.includes("unavailable") || lower.includes("fail")) return "WARN";
  return "INFO";
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseText(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("File contains no readable text lines");
  }

  const rows: RawRow[] = [];
  let m: RegExpMatchArray | null;

  for (const line of lines) {
    let row: RawRow | null = null;

    if ((m = line.match(PATTERN_OPENSTACK))) {
      // logfile_name timestamp PID LEVEL component message
      row = { timestamp: m[2], level: m[3], service: m[4], message: m[5].trim() };

    } else if ((m = line.match(PATTERN_BGL))) {
      // - epoch date node datetime node comp comp LEVEL message
      row = { timestamp: m[1], level: m[3], service: m[2], message: m[4].trim() };

    } else if ((m = line.match(PATTERN_THUNDERBIRD))) {
      // - epoch date node Mon DD HH:MM:SS host/host service[pid]: message
      row = { timestamp: m[1], level: "INFO", host: m[2], service: m[3].trim(), message: m[4].trim() };

    } else if ((m = line.match(PATTERN_WINDOWS))) {
      // YYYY-MM-DD HH:MM:SS, Level  Component  message
      row = { timestamp: m[1], level: m[2], service: m[3], message: m[4].trim() };

    } else if ((m = line.match(PATTERN_ZOOKEEPER))) {
      // YYYY-MM-DD HH:MM:SS,mmm - LEVEL [thread] - message
      row = { timestamp: m[1], level: m[2], service: extractZkClass(m[3]), message: m[4].trim() };

    } else if ((m = line.match(PATTERN_HADOOP))) {
      // YYYY-MM-DD HH:MM:SS,mmm LEVEL [thread] component: message
      row = { timestamp: m[1], level: m[2], service: m[3], message: m[4].trim() };

    } else if ((m = line.match(PATTERN_A))) {
      // General ISO timestamp + LEVEL
      row = { timestamp: m[1], level: m[2], service: m[3] ?? "unknown", message: m[4].trim() };

    } else if ((m = line.match(PATTERN_ANDROID))) {
      // MM-DD HH:MM:SS.mmm  PID  TID D component: message
      row = { timestamp: m[1], level: m[2], service: m[3].trim(), message: m[4].trim() };

    } else if ((m = line.match(PATTERN_APACHE))) {
      // [Day Mon DD HH:MM:SS YYYY] [level] message
      row = { timestamp: m[1], level: m[2], service: "apache", message: m[3].trim() };

    } else if ((m = line.match(PATTERN_SYSLOG))) {
      // Mon DD HH:MM:SS host service[pid]: message
      row = { timestamp: m[1], level: "INFO", host: m[2], service: m[3].trim(), message: m[4].trim() };

    } else if ((m = line.match(PATTERN_BRACKETED))) {
      // [timestamp] LEVEL service: message
      row = { timestamp: m[1], level: m[2], service: m[3].trim(), message: m[4].trim() };

    } else if ((m = line.match(PATTERN_PROXIFIER))) {
      // [MM.DD HH:MM:SS] app.exe - message
      row = { timestamp: m[1], level: "INFO", service: m[2], message: m[3].trim() };

    } else if ((m = line.match(PATTERN_HDFS))) {
      // YYMMDD HHMMSS thread LEVEL component: message
      row = { timestamp: `${m[1]} ${m[2]}`, level: m[3], service: m[4].trim(), message: m[5].trim() };

    } else if ((m = line.match(PATTERN_HEALTHAPP))) {
      // YYYYMMDD-HH:MM:SS:mmm|component|pid|message
      row = { timestamp: m[1], level: "INFO", service: m[2], message: m[3].trim() };

    } else if ((m = line.match(PATTERN_HPC))) {
      // jobid node event_type unix_epoch count message
      row = { timestamp: m[3], level: hpcEventLevel(m[2]), service: m[1], message: m[4].trim() };

    } else if ((m = line.match(PATTERN_SPARK))) {
      // YY/MM/DD HH:MM:SS LEVEL component: message
      row = { timestamp: m[1], level: m[2], service: m[3].trim(), message: m[4].trim() };

    } else if ((m = line.match(PATTERN_LEVEL_FIRST))) {
      // ERROR [service] message
      row = { level: m[1], service: m[2] ?? "unknown", message: m[3].trim() };

    } else {
      // Fallback — whole line is the message
      row = { level: "INFO", service: "unknown", message: line.trim() };
    }

    rows.push(row);
  }

  return {
    format: "text",
    headers: ["timestamp", "level", "service", "host", "message"],
    rows,
    sampleRows: rows.slice(0, 10),
  };
}
