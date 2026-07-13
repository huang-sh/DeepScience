# DrugBank 参考文档

## 数据库概述

**DrugBank** 是一个综合性药物数据库，包含详细的药物化学、药理学、制药和临床数据，结合了药物生物信息学资源的丰富功能和全面性。

- **官网**: https://go.drugbank.com/
- **当前版本**: v6.2 (2025年发布)
- **数据更新**: 定期更新
- **覆盖范围**: ~9,591+ 药物条目, ~4,800+ 蛋白质序列

## 访问方式

**通过 skill 访问**: 使用 `drugbank-database` skill 进行查询

```bash
# 调用 skill
drugbank-database
```

**重要提示**: DrugBank 需要**凭证访问**。使用前需要：
1. 注册 DrugBank 账号 (https://go.drugbank.com/public_users/sign_up)
2. 获取 API 密钥
3. 配置环境变量或传入凭证

**其他访问方式**:
- **Web 界面**: https://go.drugbank.com/
- **数据下载**: 需要学术许可证
- **Python 包**: 需要商业许可证

## 核心数据实体

### 1. 药物 (Drug)

**标识符**: DrugBank ID (如 `DB01001` for Acetaminophen, `DB00945` for Acetylsalicylic acid/Aspirin)

**主要注释字段**:

| 字段类别 | 字段名 | 说明 |
|----------|--------|------|
| **基础信息** | `drugbank_id` | DrugBank ID |
| | `name` | 药物名称 |
| | `synonyms` | 别名列表 |
| | `type` | 类型 (small molecule, biotech, etc.) |
| **化学性质** | `chemical_formula` | 分子式 |
| | `average_mass` | 平均分子量 |
| | `smiles` | SMILES 字符串 |
| | `inchi` | InChI 标识符 |
| **分类** | `categories` | 药物分类 (ATC, 等) |
| | `drug_groups` | 药物组别 |
| **作用机制** | `mechanism_of_action` | 作用机制描述 |
| | `targets` | 靶点列表 |
| | `enzymes` | 酶列表 |
| | `transporters` | 转运蛋白列表 |
| | `carriers` | 载体蛋白列表 |
| **药理学** | `pharmacology` | 药理学描述 |
| | `indication` | 适应症 |
| | `toxicity` | 毒性信息 |
| **临床** | `approval` | 批准状态 |
| | `prohibited_states` | 禁用状态 |

### 2. 靶点 (Target)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `target_id` | 靶点 ID |
| `name` | 靶点名称 |
| `organism` | 生物种类 |
| `action` | 作用类型 (inhibitor, agonist, etc.) |
| `uniprot_id` | UniProt 标识符 |
| `gene_name` | 基因名称 |

### 3. 药物相互作用 (Drug-Drug Interaction)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `drug_a` | 药物 A (DrugBank ID) |
| `drug_b` | 药物 B (DrugBank ID) |
| `description` | 相互作用描述 |
| `severity` | 严重程度 |

### 4. 通路关联 (Pathway)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `pathway_id` | 通路 ID |
| `name` | 通路名称 |
| `category` | 类别 (KEGG, Reactome, SMPDB) |
| `drugs` | 关联药物列表 |

## 数据类型

### 1. 化学信息

- **结构**: 2D/3D 结构, SMILES, InChI
- **性质**: 分子量, LogP, 氢键, 极性表面积
- **分类**: 化学分类

### 2. 生物学信息

- **靶点**: 蛋白质靶点信息
- **酶**: 代谢酶信息
- **转运蛋白**: 膜转运蛋白
- **载体**: 载体蛋白

### 3. 药理学数据

- **作用机制**: 详细的作用机制描述
- **适应症**: FDA 批准的适应症
- **药代动力学**: ADME 性质
- **毒性**: 毒性信息和副作用

### 4. 临床数据

- **批准状态**: FDA, EMA, 等
- **临床试验**: 临床阶段信息
- **标签**: 处方信息

## 典型使用场景

### 场景 1: 药物信息查询

**问题**: 获取药物的全面信息

**查询流程**:
1. 使用 DrugBank ID 或药物名称搜索
2. 获取药物详细信息
3. 查看作用机制和靶点
4. 检查适应症和安全性

### 场景 2: 靶点验证

**问题**: 某蛋白质是否是已知的药物靶点？

**查询流程**:
1. 搜索蛋白质名称或 UniProt ID
2. 查找相关药物
3. 分析作用类型
4. 评估临床证据

### 场景 3: 药物相互作用检查

**问题**: 两种药物是否有相互作用？

**查询流程**:
1. 输入两种药物的 DrugBank ID
2. 查询相互作用数据库
3. 评估相互作用严重程度
4. 查看相互作用描述

### 场景 4: 通路分析

**问题**: 哪些药物影响特定通路？

**查询流程**:
1. 搜索通路名称
2. 获取关联药物列表
3. 分析药物作用机制
4. 识别组合治疗可能性

## 药物分类系统

### 药物类型

| 类型 | 说明 | 示例 |
|------|------|------|
| **Small molecule** | 小分子药物 | Aspirin, Lipitor |
| **Biotech** | 生物技术药物 | Insulin, Monoclonal antibodies |
| **Propeptide** | 蛋白前体 | 胰岛素原 |
| **Polymer** | 聚合物 | PEG |
| **Cell** | 细胞治疗 | CAR-T |
| **Allergen** | 过敏原 | 花粉提取物 |

### ATC 分类系统

DrugBank 使用 WHO ATC (Anatomical Therapeutic Chemical) 分类系统:
- **第一级**: 解剖学主组 (14个)
- **第二级**: 治疗学亚组
- **第三级**: 药理学亚组
- **第四级**: 化学亚组
- **第五级**: 化学物质

## 外部数据库链接

| 数据库 | 用途 |
|--------|------|
| **UniProt** | 蛋白质序列和功能 |
| **PDB** | 蛋白质结构 |
| **KEGG** | 代谢通路 |
| **Reactome** | 生物学通路 |
| **PubChem** | 化学结构 |
| **ChEBI** | 化学实体 |
| **GenBank** | 基因序列 |

## 与其他资源的比较

| 资源 | 专注领域 | 与 DrugBank 的关系 |
|------|----------|-------------------|
| **ChEMBL** | 生物活性分子 | DrugBank 更注重已批准药物 |
| **OpenTargets** | 靶点-疾病关联 | DrugBank 提供药物详细数据 |
| **PubChem** | 化学结构 | DrugBank 更注重药理学 |
| **FDA** | 监管数据 | DrugBank 包含 FDA 批准信息 |

## 解释限制

### 数据覆盖范围

- **非穷尽收录**: 仅收录已批准或临床阶段的药物
- **质量差异**: 实验数据 > 预测数据
- **时效性**: 新批准药物可能尚未收录

### 术语标准化

- **名称差异**: 同一药物可能有多个名称
- **分类差异**: 不同系统可能有不同分类
- **地区差异**: 不同国家批准状态可能不同

### 使用建议

- **多源验证**: 与其他药物数据库交叉验证
- **版本控制**: 记录使用的 DrugBank 版本
- **许可证注意**: 检查使用许可证条款

## 许可和引用

### 数据使用

- **学术研究**: 需要学术许可证
- **商业使用**: 需要商业许可证
- **凭证要求**: 必须注册并获取 API 密钥

### 引用

使用 DrugBank 数据时请引用:

> Wishart DS, Feunang YD, Guo AC, et al. DrugBank 6.0: a comprehensive update on drug annotations, and actions. Nucleic Acids Research. 2024;52(D1):D1159-D1167.

## 额外资源

- **DrugBank 网站**: https://go.drugbank.com/
- **注册页面**: https://go.drugbank.com/public_users/sign_up
- **文档**: https://go.drugbank.com/guides/docs
- **API 文档**: 需要登录后查看
