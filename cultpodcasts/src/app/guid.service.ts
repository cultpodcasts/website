import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GuidService {

  public toBase64(guid: string): string {
    const uuidBytes = this.guidToBytes(guid);
    const uuidBase64 = btoa(String.fromCharCode(...new Uint8Array(uuidBytes)));
    const key = uuidBase64.replaceAll("/", "-").replaceAll("+", "_").replaceAll("=", "");
    return key;
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
