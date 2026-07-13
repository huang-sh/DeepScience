# PubChem 参考文档

## 数据库概述

**PubChem** 是美国国家生物技术信息中心 (NCBI) 维护的公共化学数据库，提供世界上最大的 freely available 化学结构信息，包含 110M+ 化合物和 270M+ 生物活性数据。

- **官网**: https://pubchem.ncbi.nlm.nih.gov/
- **API 基础 URL**: https://pubchem.ncbi.nlm.nih.gov/rest/pug
- **数据更新**: 持续更新
- **覆盖范围**: ~110M 化合物, ~270M 生物活性数据

## 访问方式

**通过 skill 访问**: 使用 `pubchem-database` skill 进行查询

```bash
# 调用 skill
pubchem-database
```

**直接 API 访问**:
```bash
# 浏览器直接访问
https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularWeight/JSON
```

**Python 包**:
```bash
pip install pubchempy requests
```

## 核心数据实体

### 1. 化合物 (Compound)

**标识符**: CID (Compound ID, 如 2244 for Aspirin)

**主要注释字段**:

| 字段类别 | 字段名 | 说明 |
|----------|--------|------|
| **基础信息** | `cid` | PubChem CID |
| | `molecular_formula` | 分子式 |
| | `molecular_weight` | 分子量 |
| | `canonical_smiles` | 标准 SMILES |
| | `isomeric_smiles` | 异构 SMILES |
| | `inchi` | InChI 标识符 |
| | `inchikey` | InChIKey |
| **分类** | `iupac_name` | IUPAC 名称 |
| | `common_name` | 通用名称 |
| **性质** | `xlogp` | XLogP (脂溶性) |
| | `tpsa` | 拓扑极性表面积 |
| | `h_bond_donor_count` | 氢键供体数 |
| | `h_bond_acceptor_count` | 氢键受体数 |
| | `rotatable_bond_count` | 可旋转键数 |

### 2. 生物活性数据 (Bioassay)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `aid` | 生物活性实验 ID |
| `outcome` | 实验结果 (Active/Inactive/Inconclusive) |
| `target` | 靶点信息 |
| `activity` | 活性值 (IC50, Ki, EC50 等) |
| `activity_unit` | 活性单位 |

## API 端点

### PUG-REST API

**基础端点**:
```
GET /compound/name/{name}/property/{properties}
GET /compound/cid/{cid}/property/{properties}
GET /compound/smiles/{smiles}/property/{properties}
```

**搜索端点**:
```
GET /compound/name/{name}/cids          # 名称转 CID
GET /compound/smiles/{smiles}/cids      # SMILES 转 CID
GET /compound/fastidentity/{cid}/cids    # 相同化合物搜索
```

**相似性搜索**:
```
GET /compound/fastsimilarity_2d/{cid}/cids  # 2D 相似性
GET /compound/fastsimilarity_3d/{cid}/cids  # 3D 相似性
```

**子结构搜索**:
```
GET /compound/fastsubstructure/smiles/{smiles}/cids
```

## 典型使用场景

### 场景 1: 化合物搜索

**问题**: 获取化合物的完整信息

**查询流程**:
1. 按名称或 SMILES 搜索
2. 获取 CID
3. 检索分子性质
4. 获取同义词

**Python 示例**:
```python
import pubchempy as pcp

# 按名称搜索
compounds = pcp.get_compounds('aspirin', 'name')
c = compounds[0]

print(f"CID: {c.cid}")
print(f"Formula: {c.molecular_formula}")
print(f"MW: {c.molecular_weight}")
```

### 场景 2: 药物类筛选

**问题**: 筛选符合 Lipinski Rule of Five 的化合物

**查询流程**:
1. 获取分子性质
2. 检查药类性质
3. 判断是否违规

**规则**:
- MW ≤ 500
- LogP ≤ 5
- HBD ≤ 5
- HBA ≤ 10

### 场景 3: 相似性搜索

**问题**: 找到与已知药物结构相似的化合物

**查询流程**:
1. 获取查询化合物的 SMILES
2. 执行相似性搜索
3. 设置相似度阈值
4. 分析结果

**API 示例**:
```
GET /compound/fastsimilarity_2d/2244/cids?Threshold=85
```

### 场景 4: 子结构搜索

**问题**: 找到含有特定官能团的化合物

**查询流程**:
1. 定义子结构 SMILES
2. 执行子结构搜索
3. 筛选结果

**常见子结构**:
- 羧基: `C(=O)O`
- 苯环: `c1ccccc1`
- 吡啶: `c1ccncc1`

### 场景 5: 生物活性数据

**问题**: 查询化合物的生物活性数据

**查询流程**:
1. 按 CID 查询
2. 获取生物活性摘要
3. 查看具体实验结果

**API 示例**:
```
GET /compound/cid/2244/assaysummary/JSON
```

## 搜索语法

### 标识符类型

| 类型 | 示例 | 说明 |
|------|------|------|
| 名称 | aspirin | 化合物名称 |
| CID | 2244 | PubChem CID |
| SMILES | CC(=O)OC1=CC=CC=C1C(=O)O | 结构表示 |
| InChI | InChI=1S/C9H8O4/... | 标准化学标识符 |
| InChIKey | BSYNRYMUTXBXSQ-UHFFFAOYSA-N | InChIKey |
| 分子式 | C9H8O4 | 化学式 |

### 过滤运算符

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `property/{prop1},{prop2}` | 获取特定属性 | MolecularWeight,XLogP |
| `?MaxRecords=N` | 限制结果数 | ?MaxRecords=10 |
| `?Threshold=N` | 相似度阈值 | ?Threshold=85 |

## 数据解释指南

### 分子性质解读

| 性质 | 药物类范围 | 说明 |
|------|-----------|------|
| MW | 150-500 | 分子量 |
| LogP | -0.4-5.6 | 脂溶性 |
| TPSA | <140 Ų | 极性表面积 |
| HBD | ≤5 | 氢键供体 |
| HBA | ≤10 | 氢键受体 |
| Rotatable Bonds | ≤10 | 可旋转键 |

### 相似度解读

| Tanimoto 相似度 | 解释 |
|-----------------|------|
| > 95% | 几乎相同 |
| 85-95% | 非常相似 |
| 70-85% | 相似 |
| < 70% | 较不相似 |

## 与其他资源的比较

| 资源 | 专注领域 | 与 PubChem 的关系 |
|------|----------|-------------------|
| ChEMBL | 生物活性分子 | PubChem 更广泛，ChEMBL 更聚焦 |
| DrugBank | 药物 | PubChem 包含所有化学物质 |
| HMDB | 代谢物 | PubChem 包含小分子数据库 |
| KEGG | 化学/通路 | PubChem 提供结构数据 |

## 解释限制

### 数据覆盖范围

- **非穷尽收录**: 来源于各种数据源，不完整
- **质量差异**: 数据质量不一
- **更新频率**: 不同数据源更新频率不同

### 搜索限制

- **速率限制**: 每秒 5 请求
- **请求大小**: 单次查询限制
- **异步操作**: 相似性/子结构搜索需要时间

### 使用建议

- **使用 CID**: 对于重复查询，使用 CID 更快
- **缓存结果**: 存储常用查询结果
- **批量操作**: 使用批量接口提高效率

## 引用

使用 PubChem 数据时请引用:

> Kim, S. et al. (2023) PubChem 2023 update: Nucleic acids research. Nucleic Acids Research, 51(D1), D1373-D1380.
> Bolton, E. et al. (2008) PubChem: integrated platform of small molecules and biological activities. Chapter in Annual Reports in Computational Chemistry, Volume 24.

## 额外资源

- **PubChem 主页**: https://pubchem.ncbi.nlm.nih.gov/
- **PUG-REST 文档**: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
- **PUG-REST 教程**: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest-tutorial
- **PubChemPy 文档**: https://pubchempy.readthedocs.io/
