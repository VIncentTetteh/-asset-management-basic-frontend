import fs from 'fs';
const data = fs.readFileSync('src/types/index.ts', 'utf8');

// Ensure we have correct DepreciationPolicyDto name
let result = data.replace('export interface DepreciationDto {', 'export interface DepreciationPolicyDto {');
result = result.replace('export interface DepreciationPolicyDto {', 'export interface DepreciationPolicyDto {\n    organisationId?: string;');
fs.writeFileSync('src/types/index.ts', result, 'utf8');
console.log('Fixed types');
