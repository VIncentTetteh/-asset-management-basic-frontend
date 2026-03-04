import fs from 'fs';
const data = fs.readFileSync('src/app/depreciation-policies/page.tsx', 'utf8');
const result = data.replace(
  'import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";\nimport { depreciationPolicyService } from "@/services/depreciationPolicies";',
  'import { DepreciationPolicy, DepreciationPolicyDto } from "@/types";\nimport { depreciationPolicyService } from "@/services/depreciationPolicyService";'
);
fs.writeFileSync('src/app/depreciation-policies/page.tsx', result, 'utf8');
console.log('Fixed imports');
