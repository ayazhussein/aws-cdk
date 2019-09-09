import { IResource, Construct } from "@aws-cdk/core";

interface ElasticIpAttributes {

    readonly eipAllocationId: string;
}

export interface IElasticIp extends IResource {

}

export class ElasticIp extends Resource implements IElasticIp {

    public static fromElasticIpAttribute(scope: Construct, id: string, attrs: ElasticIpAttributes) {

    }

    constructor(scope: Construct, id: string, props: )
}