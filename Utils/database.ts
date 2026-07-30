export namespace Database {

    export interface Users {
        IdUser: number
        IdCompany: number
        IdAddress: number
        Name: string
        Login: string
        TagNumber: string
        Mail: string
        Pass: string
        Token: string
        JobDescription: string
        Phone: string
        ProjectEnrolment: string
        DecisionAccount: boolean
        LastLogin: string
        IdUserChange: number
        LastChange: string
        Active: boolean
    }

    export interface UserGroupTypes {
        IdUserGroupType: number
        IdCompany: number
        Name: string
        Active: boolean,
        IdUserChange: number
        LastChange: string
    }

    export interface UserGroupNames {
        IdUserGroupName: number
        IdCompany: number
        IdUserGroupType: number
        Name: string
        FullAccess: boolean
        IdUserChange: number
        LastChange: string
        Active: boolean
    }

    export interface UserInGroups {
        IdUserInGroup: number
        IdCompany: number
        IdUser: number
        IdUserGroupName: number
        IdUserChange: number
        LastChange: string
        Active: boolean
    }

    export interface Companys {
        IdCompany: number
        Name: string
        Alias: string
        CNPJ: string
        URL: string
        IdAddress: number
        TotalUser: number
        TotalResource: number
        DueDate: string
        GatewayUser: string
        GatewayPass: string
        IdOwnerCompany: number
        Partner: boolean
        IdUserChange: number
        LastChange: string
        Active: boolean
    }

    export interface SystemParams {
        IdSystemParam: number
        IdSystemParamParent: number
        Name: string
        Description: string
        Value: string
        CustomField: string
        IdUser: number
        LastChange: string
        Active: boolean
    }

    export interface Plants {
        IdPlant: number
        IdCompany: number
        IdAddress: number
        Name: string
        ERPCode: string
        IdUserChange: number
        LastChange: string
        Active: boolean
    }

    export interface PasswordRecoverys {
        IdPasswordRecovery: number
        IdCompany: number
        IdUserAsk: number
        DateEventAsk: string
        Approved: boolean
        IdUserApproved: number
        DateEventApproved: string
        IdUserChange: number
        LastChange: string
        Active: boolean
    }

    export interface Permissions {
        IdPermission: number
        Key: string
        IdUserGroupName: number
        LastChange: string
        IdUserChange: number
        Active: boolean
    }

}