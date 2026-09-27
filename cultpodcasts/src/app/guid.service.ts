import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GuidService {

  public toBase64(guid: string): string {
    return this.toUrlBase64(this.guidToBytes(guid));
  }

  /** Film, TV, and News shares. Podcast episodes stay unprefixed via toBase64. */
  public toCatalogueShortId(guid: string, contentKind?: string | null): string {
    const prefix = cataloguePrefix(contentKind);
    const guidBytes = this.guidToBytes(guid);
    if (!prefix) {
      return this.toUrlBase64(guidBytes);
    }
    return this.toUrlBase64([prefix.charCodeAt(0), ...guidBytes]);
  }

  public parseCatalogueShortId(shortId: string): { id: string; contentKind: string | null } | null {
    const bytes = this.fromUrlBase64(shortId);
    if (!bytes) {
      return null;
    }
    if (bytes.length === 16) {
      return { id: this.bytesToGuid(bytes), contentKind: null };
    }
    if (bytes.length === 17) {
      const kind = kindFromPrefix(bytes[0]);
      if (!kind) {
        return null;
      }
      return { id: this.bytesToGuid(bytes.slice(1)), contentKind: kind };
    }
    return null;
  }

  /** Old unprefixed links stay valid. A moved Film, TV, or News id uses the new path. */
  public movedPlayablePath(slug: string, id: string, resolvedKind?: string | null): string | null {
    if (resolvedKind !== "Film" && resolvedKind !== "TvShowEpisode" && resolvedKind !== "NewsReport") {
      return null;
    }
    const root = resolvedKind === "Film" ? "film" : resolvedKind === "TvShowEpisode" ? "tv" : "news";
    return `/${root}/${encodeURIComponent(slug)}/${this.toCatalogueShortId(id, resolvedKind)}`;
  }

  private toUrlBase64(bytes: number[]): string {
    const uuidBase64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return uuidBase64.replaceAll("/", "-").replaceAll("+", "_").replaceAll("=", "");
  }

  private fromUrlBase64(shortId: string): number[] | null {
    if (!shortId) {
      return null;
    }
    let padded = shortId.replaceAll("-", "/").replaceAll("_", "+");
    const remainder = padded.length % 4;
    if (remainder !== 0) {
      padded += "=".repeat(4 - remainder);
    }
    try {
      const binary = atob(padded);
      return Array.from(binary, char => char.charCodeAt(0));
    } catch {
      return null;
    }
  }

  private bytesToGuid(bytes: number[]): string {
    const hex = bytes.map(byte => byte.toString(16).padStart(2, "0"));
    const group = (start: number, count: number, reverse: boolean) => {
      const slice = hex.slice(start, start + count);
      return (reverse ? slice.reverse() : slice).join("");
    };
    return [
      group(0, 4, true),
      group(4, 2, true),
      group(6, 2, true),
      group(8, 2, false),
      group(10, 6, false)
    ].join("-");
  }

  public getEpisodeUuid(queryParam: string): string {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuid.test(queryParam)) {
      return queryParam;
    } else {
      return "";
    }
  }

  private guidToBytes(guid: string): number[] {
    var bytes: number[] = [];
    guid.split('-').map((number, index) => {
      var bytesInChar = index < 3 ? number.match(/.{1,2}/g)!.reverse() : number.match(/.{1,2}/g);
      bytesInChar!.map((byte) => { bytes.push(parseInt(byte, 16)); })
    });
    return bytes;
  }
}

function cataloguePrefix(contentKind?: string | null): string | null {
  switch (contentKind) {
    case "Film":
      return "f";
    case "TvShowEpisode":
      return "t";
    case "NewsReport":
      return "n";
    default:
      return null;
  }
}

function kindFromPrefix(prefix: number): string | null {
  switch (prefix) {
    case "f".charCodeAt(0):
      return "Film";
    case "t".charCodeAt(0):
      return "TvShowEpisode";
    case "n".charCodeAt(0):
      return "NewsReport";
    default:
      return null;
  }
}
