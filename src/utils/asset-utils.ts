import { ExportQueryConfig } from '../types';

export class AssetUtils {
  private config: ExportQueryConfig;

  constructor(config: ExportQueryConfig) {
    this.config = config;
  }

  extractAssetUIDs(entries: any[]): string[] {
    const assetUIDs = new Set<string>();
    const extractor = this.config.dependencyExtractors.asset_reference;

    if (!extractor) {
      // Fallback to simple extraction
      for (const entry of entries) {
        this.extractAssetUIDsFromEntry(entry, assetUIDs);
      }
    } else {
      // Use configured extractor
      for (const entry of entries) {
        try {
          const extractedUIDs = extractor.extract(entry);
          extractedUIDs.forEach((uid) => assetUIDs.add(uid));
        } catch (error) {
          // Fallback to simple extraction on error
          this.extractAssetUIDsFromEntry(entry, assetUIDs);
        }
      }
    }

    return Array.from(assetUIDs);
  }

  private extractAssetUIDsFromEntry(entry: any, assetUIDs: Set<string>): void {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(entry)) {
      if (key === 'uid' && typeof value === 'string' && this.isAssetUID(value)) {
        assetUIDs.add(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          this.extractAssetUIDsFromEntry(item, assetUIDs);
        }
      } else if (typeof value === 'object' && value !== null) {
        this.extractAssetUIDsFromEntry(value, assetUIDs);
      }
    }
  }

  private isAssetUID(uid: string): boolean {
    // Asset UIDs typically start with 'blt' and are 24+ characters
    return uid.startsWith('blt') && uid.length >= 24;
  }
}
