const d1 = new Date("2026-10-26T13:00:00+01:00");
console.log("2026-10-26 13:00 CET:", d1.toISOString());

const d2 = new Date("2026-10-27T10:00:00+01:00");
console.log("2026-10-27 10:00 CET:", d2.toISOString());

// Check system timezone
console.log("System time:", new Date().toString());
console.log("Timezone offset:", new Date().getTimezoneOffset());
