/**
 * Malware scanning seam.
 *
 * There is NO malware scanner in this deployment. Nothing here inspects a file
 * for malicious content: the default scanner returns SKIPPED, and that value is
 * persisted on `Attachment.scanStatus` so the absence of scanning is visible in
 * the data rather than assumed.
 *
 * To make scanning real, run a scanning service (e.g. ClamAV's clamd, or a
 * hosted equivalent) and implement a scanner that streams the buffer to it
 * before the object is marked ATTACHED. Until then, do not describe uploads as
 * scanned.
 */

export type ScanStatus = "PENDING" | "CLEAN" | "INFECTED" | "ERROR" | "SKIPPED";

export interface ScanResult {
  status: ScanStatus;
  scanner: string;
  detail?: string;
}

export interface Scanner {
  readonly name: string;
  scan(buffer: Buffer, filename: string): Promise<ScanResult>;
}

/** No scanner configured: report honestly instead of implying a clean verdict. */
class NoopScanner implements Scanner {
  readonly name = "none";
  async scan(): Promise<ScanResult> {
    return {
      status: "SKIPPED",
      scanner: this.name,
      detail: "No malware scanning infrastructure is configured",
    };
  }
}

let scanner: Scanner = new NoopScanner();

export function setScanner(next: Scanner): void {
  scanner = next;
}

export function scannerName(): string {
  return scanner.name;
}

export async function scanBuffer(buffer: Buffer, filename: string): Promise<ScanResult> {
  try {
    return await scanner.scan(buffer, filename);
  } catch (err) {
    return {
      status: "ERROR",
      scanner: scanner.name,
      detail: err instanceof Error ? err.message : "scan failed",
    };
  }
}
