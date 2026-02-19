export interface Organisation {
    id: string;
    name: string;
}

export interface OrganisationDto {
    id?: string;
    name: string;
}

export interface Department {
    id: string;
    name: string;
    organisationId: string;
}

export interface DepartmentDto {
    id?: string;
    name: string;
    organisationId: string;
}

export enum AssetState {
    REGISTERED = "REGISTERED",
    ASSIGNED = "ASSIGNED",
    SCRAPPED = "SCRAPPED",
}

export interface Asset {
    id: string;
    name: string;
    category: string;
    purchaseCost: number;
    usefulLifeInYears: number;
    state: AssetState;
    departmentId?: string;
    organisationId?: string;
}

export interface AssetDto {
    id?: string;
    name: string;
    category: string;
    purchaseCost: number;
    usefulLifeInYears: number;
    state?: AssetState;
    departmentId?: string;
    organisationId?: string;
}
