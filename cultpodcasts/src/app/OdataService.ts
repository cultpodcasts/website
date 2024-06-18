// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";
import { ODataEntitiesResponse, ODataEntityResponse } from './models/odata-response';
import { ISearchRequest } from "./ISearchRequest";

/**
 * The ``ODataService`` provides functionality to query an OData-enabled 
 * endpoint and parse the HTTP response to a type-safe entity and its 
 * metadata.
 */
@Injectable({ providedIn: `root` })
export class ODataService {

    /**
     * Constructs an ``ODataService``.
     * 
     * @param httpClient - The ``HttpClient`` to be used for queries.
     */
    constructor(private httpClient: HttpClient) {
    }

    /**
     * Queries a OData-enabled enpoint for a entities of type ``T``. The response also 
     * contains all metadata of the response data.
     *
     * @typeParam T - Type of the entity
     * @param url - URL for an OData-enabled enpoint
     * @returns Response containing metadata and entities
     */
    getEntities<T>(url: string, searchRequest: ISearchRequest): Observable<ODataEntitiesResponse<T>> {
        return this.httpClient
            .post<any>(url, searchRequest, { observe: 'response' })
            .pipe(map(response => new ODataEntitiesResponse<T>(response)));
    }
}
