# Therapeutic Targets Module

## 模块概述

本模块提供**治疗靶点**相关的数据资源，主要用于药物靶点发现、验证和优先级排序。

## 设计意图

本模块回答的核心问题：
- **靶点发现**：哪些基因是某疾病的潜在治疗靶点？
- **靶点评估**：某基因的可成药性（tractability）、安全性和临床先例如何？
- **证据整合**：支持靶点-疾病关联的遗传学、组学、文献证据有哪些？
- **药物信息**：某疾病有哪些已知药物？这些药物的作用机制是什么？
- **竞争情报**：某靶点有哪些药物在开发？临床进展如何？

## 覆盖范围

| 资源 | 数据类型 | 主要用途 |
|------|----------|----------|
| **OpenTargets** | 靶点-疾病关联、药物信息、多组学证据 | 靶点发现与验证、药物重定位 |
| **ChEMBL** | 生物活性分子、化合物-靶点相互作用、药物信息 | 化合物筛选、SAR 研究、药物发现 |
| **DrugBank** | 药物详细数据、作用机制、药物相互作用 | 药物信息查询、靶点验证、安全性评估 |
| **FDA** | 监管数据、不良事件、召回、标签 | 安全性监测、监管合规、上市后监测 |

## 使用说明

### 1. 读取入口文档

使用任何资源前，请先阅读对应的参考文档：
- `OpenTargets_ref.md` - OpenTargets Platform 数据库详解
- `ChEMBL_ref.md` - ChEMBL 生物活性分子数据库详解
- `DrugBank_ref.md` - DrugBank 综合药物数据库详解
- `FDA_ref.md` - openFDA 监管数据详解

### 2. 数据访问方式

**OpenTargets** 提供 GraphQL API 访问（通过 skill 执行）：
```python
# 调用 opentargets-database skill
```

**ChEMBL** 提供 REST API 访问（通过 skill 执行）：
```python
# 调用 chembl-database skill
```

**DrugBank** 需要凭证访问（通过 skill 执行）：
```python
# 调用 drugbank-database skill (需要 API 密钥)
```

**FDA** 提供开放 REST API 访问（通过 skill 执行）：
```python
# 调用 fda-database skill
```

### 3. 数据更新频率

| 资源 | 更新频率 | 备注 |
|------|----------|------|
| OpenTargets | 季度更新 | 当前版本：2025年10月发布 |
| ChEMBL | 定期更新 | 当前版本：v30+ (2024-2025) |
| DrugBank | 定期更新 | 当前版本：v6.2 (需要许可证) |
| FDA | 实时更新 | API 实时访问最新数据 |

## 解释限制

### OpenTargets
- **非穷尽覆盖**：仅收录有证据支持的靶点-疾病关联
- **评分是相对的**：关联分数用于排序，不代表绝对置信度
- **研究偏倚**：研究充分的疾病通常分数更高，不代表新兴疾病的靶点不可靠
- **证据质量差异**：专家审编资源 > 计算预测，需权重不同对待

### ChEMBL
- **非穷尽收录**：仅收录已发表的数据
- **数据偏倚**：某些靶点/化合物被过度研究
- **实验条件影响**：活性值受实验条件影响，需注意比较
- **数据一致性**：不同实验室数据可能不一致

### DrugBank
- **需要许可证**：学术或商业使用需要明确许可
- **非穷尽收录**：仅收录已批准或临床阶段药物
- **凭证要求**：必须注册并获取 API 密钥
- **版本控制**：不同版本数据可能有差异

### FDA
- **报告偏倚**：不良事件多数为自愿报告
- **不证明因果关系**：报告存在不代表药物/设备导致问题
- **数据时效性**：最新报告可能尚未收录
- **缺失字段**：并非所有记录都包含所有字段

## 引用

使用 OpenTargets 数据时请引用：
> Ochoa, D. et al. (2025) Open Targets Platform: facilitating therapeutic hypotheses building in drug discovery. Nucleic Acids Research, 53(D1):D1467-D1477.

使用 ChEMBL 数据时请引用：
> Mendez D, Gaulton A, Bento AP, et al. ChEMBL: towards direct deposition of bioassay data. Nucleic Acids Research. 2019;47(D1):D930-D940.

使用 DrugBank 数据时请引用：
> Wishart DS, Feunang YD, Guo AC, et al. DrugBank 6.0: a comprehensive update on drug annotations, and actions. Nucleic Acids Research. 2024;52(D1):D1159-D1167.

使用 FDA 数据时请引用：
> openFDA is an FDA initiative. Data sourced from FDA datasets. https://open.fda.gov/
