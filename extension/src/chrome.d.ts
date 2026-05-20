type ChromeTab = {
  id?: number;
  index?: number;
  windowId?: number;
};

type ChromeMessageSender = {
  tab?: ChromeTab;
};

declare const chrome: {
  action: {
    onClicked: {
      addListener(listener: (tab: ChromeTab) => void | Promise<void>): void;
    };
  };
  runtime: {
    lastError?: { message?: string };
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: ChromeMessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
    sendMessage(message: unknown, response?: (response?: unknown) => void): void;
  };
  scripting: {
    executeScript(options: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown>;
  };
  storage: {
    local: {
      get(keys: string | string[], callback: (items: Record<string, unknown>) => void): void;
      remove(keys: string | string[]): Promise<void>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  tabs: {
    create(options: {
      active?: boolean;
      index?: number;
      openerTabId?: number;
      url: string;
    }): Promise<ChromeTab>;
    query(options: { url?: string | string[] }): Promise<ChromeTab[]>;
    update(
      tabId: number,
      options: {
        active?: boolean;
        url?: string;
      },
    ): Promise<ChromeTab>;
  };
};
