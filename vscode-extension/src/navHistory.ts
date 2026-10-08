export interface NavLocation {
  uri: string;
  scrollTop: number;
}

// Browser-style back/forward lists. Each entry is where the reader was when they left it.
// Callers peek, show the target, and commit only if showing it succeeded.
export class NavHistory {
  private readonly limit: number;
  private readonly back: NavLocation[] = [];
  private forward: NavLocation[] = [];

  constructor(limit = 100) {
    this.limit = limit;
  }

  get canGoBack(): boolean {
    return this.back.length > 0;
  }

  get canGoForward(): boolean {
    return this.forward.length > 0;
  }

  push(current: NavLocation): void {
    this.back.push(current);
    if (this.back.length > this.limit) {
      this.back.shift();
    }
    this.forward = [];
  }

  peekBack(): NavLocation | undefined {
    return this.back[this.back.length - 1];
  }

  peekForward(): NavLocation | undefined {
    return this.forward[this.forward.length - 1];
  }

  commitBack(current: NavLocation): void {
    if (this.back.pop()) {
      this.forward.push(current);
    }
  }

  commitForward(current: NavLocation): void {
    if (this.forward.pop()) {
      this.back.push(current);
    }
  }
}
