const fs = require("fs/promises");
const path = require("path");
const EventEmitter = require("events");
const { LOCAL_STORAGE_ROOT } = require("../shared/platformData");

module.exports = function createRuntimeEventStore() {
  const emitter = new EventEmitter();
  const events = [];
  const maxEvents = Number(process.env.MAXED_STREAM_BUFFER_SIZE || 500);
  const eventLogPath = path.join(LOCAL_STORAGE_ROOT, "runtime-events.jsonl");

  async function append(event) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      ...event,
    };

    events.push(entry);
    if (events.length > maxEvents) {
      events.splice(0, events.length - maxEvents);
    }

    await fs.mkdir(path.dirname(eventLogPath), { recursive: true });
    await fs.appendFile(eventLogPath, `${JSON.stringify(entry)}\n`);
    emitter.emit("event", entry);
    return entry;
  }

  function list(limit = 100) {
    return events.slice(-Math.max(1, Math.min(limit, maxEvents))).reverse();
  }

  function subscribe(listener) {
    emitter.on("event", listener);
    return () => emitter.off("event", listener);
  }

  return {
    append,
    list,
    subscribe,
    eventLogPath,
  };
};
