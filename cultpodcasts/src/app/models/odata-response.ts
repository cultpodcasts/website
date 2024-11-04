// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { HttpResponse } from "@angular/common/http";

/**
 * Base class for all OData Responses.
 */
export abstract class ODataResponse {

    /**
     * The HTTP Status Code, such as ``200`` (OK) or ``404`` (Not Found).
     */
    public readonly status: number;

    /**
     * The Response Headers.
     */
    public readonly headers: Array<[string, string | null]>;

    /**
     * The ``Map<string, any>``, that holds the OData Metadata.
     */
    public readonly metadata: Map<string, any>;

    /**
     * Initialized common data for all ``ODataResponse`` implementations, such as 
     * status, headers and metadata.
     * 
     * @param response - Response returned by the Webservice
     */
    constructor(response: HttpResponse<any>) {
        this.status = response.status;
        this.headers = response.headers.keys().map(k => [k, response.headers.get(k)])
        this.metadata = this.getMetadata(response.body);
    }

    /**
     * Builds up the OData Metadata, which are basically all keys prefixed with ``@odata``.
     * 
     * @param data - The untyped response body
     * @returns A map of Metadata
     */
    private getMetadata(data: any): Map<string, any> {
        const metadata = new Map<string, any>();
        Object.keys(data)
            .filter((key) => key.startsWith("@odata"))
            .forEach((key) => metadata.set(key.replace("@odata.", ""), data[key]));
        return metadata;
    }
};

/**
 * An OData response containing a single entity, such as a lookup by ID.
 */
export class ODataEntityResponse<T> extends ODataResponse {

    /**
     * An entity of type ``T`` or ``null``, if the response didn't return data.
     */
    public readonly entity: T | null;

    /**
     * Constructs a new ``ODataEntityResponse`` by parsing the response body.
     * 
     * @param response - The HTTP Response.
     */
    constructor(response: HttpResponse<any>) {
        super(response);

        this.entity = this.getEntity(response.body);
    }

    /**
     * Returns the entity of type ``T`` or ``null``.
     * 
     * @param data - The untyped response body
     * @returns Entity of type ``T``
     */
    private getEntity(data: any): T {

        let entity = {} as T;

        Object.keys(data)
            .filter((key) => !key.startsWith("@odata"))
            .forEach((key) => entity[key as keyof T] = data[key]);

        return entity;
    }
}

/**
 * Returns an entities array of type ``T``.
 */
export class ODataEntitiesResponse<T> extends ODataResponse {

    public readonly entities: T[];

    /**
     * Constructs a new ``ODataEntityResponse`` by parsing the response body.
     * 
     * @param response - The HTTP Response.
     */
    constructor(response: HttpResponse<any>) {
        super(response);
        this.entities = this.getEntities(response.body);
    }

    /**
     * Returns an array entities of type ``T`` returned by the OData-enabled endpoint.
     * 
     * @param data - The untyped response body
     * @returns Array of type ``T`` elements
     */
    private getEntities(data: any): T[] {
        if (data.value) {
            return (data.value as T[]);
        }
        return [];
    }
}
