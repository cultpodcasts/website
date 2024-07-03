import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GuidService {

  constructor() { }

  public toBase64(guid: string): string {
    const uuidBytes = this.guidToBytes(guid);
    const uuidBase64 = btoa(String.fromCharCode(...new Uint8Array(uuidBytes)));
    const key = uuidBase64.replaceAll("/", "-").replaceAll("+", "_").replaceAll("=", "");
    return key;
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
