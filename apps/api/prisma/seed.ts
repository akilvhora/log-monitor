import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SERVICES = [
  "auth-service",
  "payment-service",
  "user-service",
  "notification-service",
  "api-gateway",
  "inventory-service",
  "order-service",
];

const HOSTS = ["prod-01", "prod-02", "prod-03", "prod-04"];
const ENVIRONMENTS = ["production", "production", "production", "staging"];

const LEVELS = ["DEBUG", "INFO", "INFO", "INFO", "WARN", "ERROR", "ERROR", "FATAL"] as const;

const MESSAGES: Record<string, string[]> = {
  DEBUG: [
    "Cache hit for key user:$ID",
    "Processing request $ID",
    "Database query executed in $MS ms",
    "Token validated for user $ID",
    "Rate limit check passed for IP $IP",
  ],
  INFO: [
    "User $ID logged in successfully",
    "Payment of $$AMOUNT processed for order $ID",
    "Email sent to user $ID",
    "Order $ID created successfully",
    "Inventory updated for product $ID",
    "New user $ID registered",
    "Session started for user $ID",
    "Request completed in $MS ms",
    "Health check passed",
    "Configuration reloaded",
  ],
  WARN: [
    "High memory usage: $PCT% of limit",
    "Slow query detected: $MS ms for getUserById",
    "Retry attempt $N for payment $ID",
    "Rate limit approaching for IP $IP",
    "Deprecated API version called by user $ID",
    "Cache miss for key product:$ID, falling back to DB",
    "JWT token expiring soon for user $ID",
    "Connection pool at $PCT% capacity",
  ],
  ERROR: [
    "Failed to process payment for order $ID: Card declined",
    "Database connection timeout after $MS ms",
    "Unhandled exception in payment processor: NullReferenceException",
    "Failed to send email to user $ID: SMTP connection refused",
    "Order $ID failed: Insufficient inventory for product $PROD",
    "Authentication failed for user $ID: Invalid credentials",
    "External API call failed: timeout after $MS ms",
    "Failed to acquire database lock after $N retries",
    "Redis connection lost: ECONNREFUSED 127.0.0.1:6379",
    "Webhook delivery failed for event $ID: HTTP 503",
    "File upload failed: storage quota exceeded",
    "Session validation failed: token signature mismatch",
  ],
  FATAL: [
    "Database cluster unreachable: all replicas down",
    "Out of memory: killed by OOM killer",
    "Critical configuration missing: PAYMENT_API_KEY not set",
    "Disk full: unable to write to /var/log",
  ],
};

const STACK_TRACES: string[] = [
  `Error: Card declined\n    at PaymentProcessor.charge (/app/services/payment.ts:142:11)\n    at OrderService.processPayment (/app/services/order.ts:89:22)\n    at async POST /api/orders (/app/routes/orders.ts:45:5)`,
  `Error: Connection timeout\n    at PrismaClient._executeRequest (/app/node_modules/@prisma/client/index.js:892:15)\n    at async UserService.findById (/app/services/user.ts:34:18)\n    at async GET /api/users/:id (/app/routes/users.ts:23:7)`,
  `NullReferenceException: Object reference not set\n    at PaymentGateway.processRefund (PaymentGateway.cs:234)\n    at RefundController.ProcessRefund (RefundController.cs:67)\n    at lambda_method (Closure <>f__AnonymousType0:18)`,
  `Error: ECONNREFUSED 127.0.0.1:6379\n    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1144:16)`,
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function interpolate(template: string): string {
  return template
    .replace(/\$ID/g, String(randomInt(1000, 9999)))
    .replace(/\$MS/g, String(randomInt(50, 8000)))
    .replace(/\$PCT/g, String(randomInt(70, 99)))
    .replace(/\$N/g, String(randomInt(1, 5)))
    .replace(/\$IP/g, `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`)
    .replace(/\$AMOUNT/g, String((randomInt(100, 50000) / 100).toFixed(2)))
    .replace(/\$PROD/g, `PROD-${randomInt(100, 999)}`);
}

function generateMetadata(level: string, service: string): Record<string, unknown> | null {
  if (level === "DEBUG") return null;
  const base: Record<string, unknown> = {
    requestId: `req-${Math.random().toString(36).slice(2, 10)}`,
    userId: randomInt(1000, 9999),
    duration: randomInt(10, 5000),
  };
  if (level === "ERROR" || level === "FATAL") {
    base.stackTrace = randomFrom(STACK_TRACES);
    base.errorCode = `${service.toUpperCase().split("-")[0]}_${randomInt(1000, 9999)}`;
  }
  if (service === "payment-service") {
    base.orderId = `ORD-${randomInt(10000, 99999)}`;
    base.amount = (randomInt(100, 50000) / 100).toFixed(2);
  }
  return base;
}

async function main() {
  console.log("Seeding database with 10,000 log entries...");

  await prisma.logEntry.deleteMany();

  const TOTAL = 10_000;
  const BATCH_SIZE = 500;
  const now = new Date();

  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const entries = [];
    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL; j++) {
      const level = randomFrom(LEVELS);
      const service = randomFrom(SERVICES);

      // Spread timestamps over the last 7 days, with more recent entries more likely
      const hoursAgo = Math.pow(Math.random(), 1.5) * 168; // 7 days
      const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

      const metadata = generateMetadata(level, service);

      entries.push({
        timestamp,
        level,
        service,
        message: interpolate(randomFrom(MESSAGES[level])),
        metadata: metadata ? JSON.stringify(metadata) : null,
        traceId: `trace-${Math.random().toString(36).slice(2, 12)}`,
        host: randomFrom(HOSTS),
        environment: randomFrom(ENVIRONMENTS),
      });
    }

    await prisma.logEntry.createMany({ data: entries });
    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, TOTAL)} / ${TOTAL}`);
  }

  const counts = await prisma.logEntry.groupBy({
    by: ["level"],
    _count: { id: true },
    orderBy: { level: "asc" },
  });

  console.log("\nSeed complete. Log counts by level:");
  for (const c of counts) {
    console.log(`  ${c.level}: ${c._count.id}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
