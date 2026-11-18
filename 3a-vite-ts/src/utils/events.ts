// Minimal event bus.

export type EventHandler = (payload?: any) => void;

export interface EventBus {
  on(type: string, handler: EventHandler): () => void;
  off(type: string, handler: EventHandler): void;
  emit(type: string, payload?: unknown): void;
}

export function createEventBus(): EventBus {
  const handlers = new Map<string, EventHandler[]>();
  return {
    on(type, handler) {
      if (!handlers.has(type)) {
        handlers.set(type, []);
      }
      handlers.get(type)!.push(handler);
      return () => this.off(type, handler);
    },
    off(type, handler) {
      const list = handlers.get(type);
      if (list) {
        const index = list.indexOf(handler);
        if (index >= 0) {
          list.splice(index, 1);
        }
      }
    },
    emit(type, payload) {
      const list = handlers.get(type);
      if (list) {
        for (let k = 0; k < list.length; k++)
          try {
            list[k](payload);
          } catch (err: any) {
            console.error(`[events] handler for "${type}" threw`, err);
          }
      }
    },
  };
}
