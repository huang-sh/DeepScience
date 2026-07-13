# ChEMBL 参考文档

## 数据库概述

**ChEMBL** 是欧洲生物信息学研究所 (EBI) 维护的手工 curated 生物活性分子数据库，包含超过 200 万个化合物、1900 万个生物活性测量数据、13000+ 个药物靶点，以及已批准药物和临床候选药物的数据。

- **官网**: https://www.ebi.ac.uk/chembl/
- **API**: https://www.ebi.ac.uk/chembl/api/data/docs
- **数据更新**: 定期更新
- **覆盖范围**: ~200万化合物, ~1900万生物活性数据, ~13000个靶点

## 访问方式

**通过 skill 访问**: 使用 `chembl-database` skill 进行查询

```bash
# 调用 skill
chembl-database
```

skill 提供的主要功能：
- `molecule` - 化合物查询（按 ID、名称、属性）
- `target` - 靶点信息查询
- `activity` - 生物活性数据查询
- `drug` - 药物信息查询
- `mechanism` - 作用机制查询
- `similarity` - 相似性搜索
- `substructure` - 子结构搜索

## 核心数据实体

### 1. 化合物 (Molecule)

**标识符**: ChEMBL ID (如 `CHEMBL25` for Aspirin)

**主要注释字段**:

| 字段类别 | 字段名 | 说明 |
|----------|--------|------|
| **基础信息** | `pref_name` | 优先名称 |
| | `molecule_type` | 分子类型 (Small molecule, Antibody 等) |
| | `chembl_id` | ChEMBL ID |
| **结构** | `molecule_structures` | 分子结构信息 |
| | `canonical_smiles` | 标准 SMILES |
| | `standard_inchi` | 标准 InChI |
| **性质** | `molecule_properties` | 分子性质 |
| | `mw_freebase` | 分子量 |
| | `alogp` | ALogP 值 |
| | `hba` | 氢键受体数 |
| | `hbd` | 氢键给体数 |
| | `psa` | 极性表面积 |
| | `rtb` | 可旋转键数 |

### 2. 靶点 (Target)

**标识符**: ChEMBL ID (如 `CHEMBL203` for EGFR)

**主要注释字段**:

| 字段名 | 说明 |
|--------|------|
| `pref_name` | 靶点名称 |
| `target_type` | 靶点类型 (SINGLE PROTEIN, PROTEIN COMPLEX 等) |
| `organism` | 生物种类 |
| `target_chembl_id` | ChEMBL ID |

### 3. 生物活性 (Activity)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `molecule_chembl_id` | 化合物 ChEMBL ID |
| `target_chembl_id` | 靶点 ChEMBL ID |
| `standard_type` | 标准类型 (IC50, Ki, EC50, 等) |
| `standard_value` | 标准值 |
| `standard_units` | 标准单位 (nM, uM, 等) |
| `pchembl_value` | pChEMBL 值 (-log 标度) |
| `assay_chembl_id` | 实验 ChEMBL ID |

### 4. 药物 (Drug)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `molecule_chembl_id` | 化合物 ChEMBL ID |
| `first_approval` | 首次批准年份 |
| `marketing_status` | 上市状态 |
| `drug_chembl_id` | 药物 ChEMBL ID |

### 5. 作用机制 (Mechanism)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `molecule_chembl_id` | 化合物 ChEMBL ID |
| `target_chembl_id` | 靶点 ChEMBL ID |
| `mechanism_of_action` | 作用机制描述 |
| `action_type` | 作用类型 (INHIBITOR, AGONIST, 等) |

## 生物活性数据类型

### 常见活性类型

| 类型 | 说明 | 典型单位 |
|------|------|----------|
| **IC50** | 半抑制浓度 | nM, uM |
| **Ki** | 抑制常数 | nM, uM |
| **EC50** | 半效应浓度 | nM, uM |
| **Kd** | 解离常数 | nM, uM |
| **Potency** | 效能 | 各种单位 |
| **Selectivity** | 选择性 | 比值 |

### pChEMBL 值

- **定义**: pChEMBL = -log10(标准值，以 M 为单位)
- **用途**: 标准化不同单位的活性值
- **优点**: 便于比较不同实验的活性
- **范围**: 通常为 3-12 (对应 1mM 到 1pM)

## 过滤运算子

ChEMBL 支持 Django 风格的查询过滤器：

| 运算子 | 说明 | 示例 |
|--------|------|------|
| `__exact` | 精确匹配 | `pref_name__exact='ASPIRIN'` |
| `__iexact` | 不区分大小写 | `pref_name__iexact='aspirin'` |
| `__contains` | 包含 | `pref_name__contains='SPIRIN'` |
| `__icontains` | 不区分大小写包含 | `pref_name__icontains='aspirin'` |
| `__gt` | 大于 | `standard_value__gt=100` |
| `__gte` | 大于等于 | `standard_value__gte=100` |
| `__lt` | 小于 | `standard_value__lt=1000` |
| `__lte` | 小于等于 | `standard_value__lte=1000` |
| `__range` | 范围 | `mw__range=[200, 500]` |
| `__in` | 列表 | `chembl_id__in=['A', 'B']` |
| `__isnull` | 空值检查 | `pchembl_value__isnull=False` |

## 典型使用场景

### 场景 1: 寻找靶点抑制剂

**问题**: 找到某靶点的强效抑制剂

**查询流程**:
1. 搜索靶点获取 ChEMBL ID
2. 查询该靶点的活性数据 (按 IC50 筛选)
3. 提取化合物 ID 并获取详细信息

### 场景 2: 分析已知药物

**问题**: 了解某药物的所有信息

**查询流程**:
1. 获取药物信息
2. 查询作用机制
3. 查询所有生物活性数据
4. 分析靶点谱

### 场景 3: 结构-活性关系 (SAR) 研究

**问题**: 找到与某化合物相似的分子及其活性

**查询流程**:
1. 执行相似性搜索
2. 对每个化合物获取活性数据
3. 分析结构-活性关系

### 场景 4: 虚拟筛选

**问题**: 找到符合特定性质的化合物

**查询流程**:
1. 按分子性质筛选 (MW, LogP, HBD, HBA)
2. 限制类药物性质
3. 获取候选化合物列表

## 数据解释指南

### 分子性质解读

| 性质 | 类药范围 | 说明 |
|------|----------|------|
| **MW** | 150-500 | 分子量 |
| **LogP** | -0.4-5.6 | 脂溶性 |
| **HBD** | ≤5 | 氢键给体 |
| **HBA** | ≤10 | 氢键受体 |
| **PSA** | <140 Ų | 极性表面积 |
| **RTB** | ≤10 | 可旋转键 |

### 活性强度判断

| pChEMBL 值 | 活性强度 | IC50 约 |
|------------|----------|---------|
| > 9 | 极强 | < 1 nM |
| 8-9 | 很强 | 1-10 nM |
| 7-8 | 强 | 10-100 nM |
| 6-7 | 中等 | 100-1000 nM |
| < 6 | 弱 | > 1000 nM |

### 数据质量考虑

| 注意事项 | 说明 |
|----------|------|
| **数据有效性** | 检查 `data_validity_comment` 字段 |
| **重复记录** | 注意 `potential_duplicate` 标志 |
| **实验类型** | 区分体内/体外实验 |
| **单位一致性** | 确认标准单位 |

## 与其他资源的比较

| 资源 | 专注领域 | 与 ChEMBL 的关系 |
|------|----------|------------------|
| **OpenTargets** | 靶点-疾病关联 | ChEMBL 提供药物/化合物数据 |
| **PubChem** | 化学结构 | ChEMBL 更注重生物活性 |
| **DrugBank** | 已批准药物 | ChEMBL 包含更多实验化合物 |
| **BindingDB** | 结合数据 | ChEMBL 数据来源之一 |

## 解释限制

### 数据覆盖范围

- **非穷尽收录**: 仅收录已发表的数据
- **偏倚**: 某些靶点/化合物被过度研究
- **时效性**: 最新发表可能尚未收录

### 数据质量

- **手工 curated**: 数据质量较高
- **不一致性**: 不同实验室数据可能不一致
- **实验条件**: 活性值受实验条件影响

### 使用建议

- **多源验证**: 关键数据应从多个源验证
- **实验条件**: 注意实验条件对活性的影响
- **最新数据**: 定期检查数据更新

## 版本与引用

### 数据版本

- ChEMBL 定期发布新版本
- 当前版本约为 v30+ (2024-2025)
- 查看 https://www.ebi.ac.uk/chembl/ 获取最新版本信息

### 引用

使用 ChEMBL 数据时请引用:

> Mendez D, Gaulton A, Bento AP, et al. ChEMBL: towards direct deposition of bioassay data. Nucleic Acids Research. 2019;47(D1):D930-D940.

## 额外资源

- **ChEMBL 网站**: https://www.ebi.ac.uk/chembl/
- **API 文档**: https://www.ebi.ac.uk/chembl/api/data/docs
- **Python 客户端**: https://github.com/chembl/chembl_webresource_client
- **示例 Notebook**: https://github.com/chembl/notebooks
