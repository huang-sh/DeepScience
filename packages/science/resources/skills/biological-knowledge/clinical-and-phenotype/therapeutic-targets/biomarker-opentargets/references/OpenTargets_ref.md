# OpenTargets Platform 参考文档

## 数据库概述

**OpenTargets Platform** 是一个用于系统识别和优先排序潜在治疗药物靶点的综合资源。它整合了人类遗传学、组学、文献和化学数据来构建和评分靶点-疾病关联。

- **官网**: https://www.opentargets.org/
- **数据更新**: 季度更新
- **覆盖范围**: ~20,000 基因靶点, ~50,000 疾病, ~400,000 靶点-疾病关联

## 访问方式

**通过 skill 访问**: 使用 `opentargets-database` skill 进行查询

```bash
# 调用 skill
opentargets-database
```

skill 提供的主要功能：
- `search_entities()` - 搜索靶点、疾病、药物
- `get_target_info()` - 获取靶点注释
- `get_disease_info()` - 获取疾病信息
- `get_target_disease_evidence()` - 获取支持证据
- `get_known_drugs_for_disease()` - 查找疾病的已知药物
- `get_drug_info()` - 获取药物详情

## 核心数据实体

### 1. 靶点 (Target)

**标识符**: Ensembl Gene ID (如 `ENSG00000157764` for BRAF)

**主要注释字段**:

| 字段类别 | 字段名 | 说明 |
|----------|--------|------|
| **基础信息** | `approvedSymbol` | HGNC 批准的基因符号 |
| | `approvedName` | 基因全称 |
| | `biotype` | 基因生物类型 (protein_coding, lncRNA 等) |
| **可成药性** | `tractability` | 不同模态的可成药性评估 |
| **安全性** | `safetyLiabilities` | 已知安全性担忧 |
| **遗传约束** | `geneticConstraint` | gnomAD 约束分数 (pLI, LOEUF) |
| **表达** | `expression` | 组织特异性表达 (GTEx) |
| **亚细胞定位** | `subcellularMapping` | UniProt 亚细胞定位 |

### 2. 疾病 (Disease)

**标识符**: EFO ID (Experimental Factor Ontology, 如 `EFO_0000249` for Alzheimer's disease)

**主要注释字段**:

| 字段名 | 说明 |
|--------|------|
| `name` | 疾病名称 |
| `description` | 疾病描述 |
| `therapeuticAreas` | 高层级疾病分类 (如神经系统疾病、肿瘤) |
| `phenotypes` | 关联的 HPO 表型术语 |

### 3. 药物 (Drug)

**标识符**: ChEMBL ID (如 `CHEMBL25` for ASPIRIN)

**主要注释字段**:

| 字段名 | 说明 |
|--------|------|
| `name` | 药物名称 |
| `synonyms` | 别名列表 |
| `drugType` | 类型 (small molecule, antibody, etc.) |
| `maximumClinicalTrialPhase` | 最高临床试验阶段 (1-4) |
| `mechanismsOfAction` | 作用机制 (靶点 + 作用类型) |
| `indications` | 适应症及临床试验阶段 |
| `withdrawnNotice` | 撤市信息 (如有) |

## 证据类型 (Evidence Types)

OpenTargets 整合多种数据源，按证据类型分类：

### 1. 遗传关联 (genetic_association)

**数据源**: GWAS Catalog, UK Biobank, Gene burden, ClinVar, Rare variants

**评分要素**:
- GWAS: P值、OR值、L2G (Loc2Gene) 分数
- 罕见变异: CADD 分数、功能预测

**解释**: 人类遗传学证据是靶点-疾病关联最强的支持

### 2. 体细胞突变 (somatic_mutation)

**数据源**: Cancer Gene Census, IntOGen, Cancer Biomarkers

**解释**: 癌症中驱动基因的体细胞突变证据

### 3. 已知药物 (known_drug)

**数据源**: ChEMBL, DrugBank (已批准和临床阶段药物)

**解释**: 临床先例是最强的可成药性证据

### 4. 受影响通路 (affected_pathway)

**数据源**: CRISPR screens, Reactome, pathway analyses

**解释**: 靶点位于疾病相关通路中的证据

### 5. RNA 表达 (rna_expression)

**数据源**: Expression Atlas 差异表达分析

**解释**: 疾病组织中基因表达改变证据

### 6. 动物模型 (animal_model)

**数据源**: IMPC 小鼠表型

**解释**: 基因敲除/敲入小鼠的相关表型

### 7. 文本挖掘 (literature)

**数据源**: Europe PMC 文本挖掘

**解释**: 需要人工验证，仅作为补充线索

## 关联分数 (Association Scores)

### 分数计算

- **范围**: 0-1 (越高 = 证据越强)
- **聚合方法**: 调和均值 (harmonic sum)
- **分类型**: 每种证据类型有独立分数

### 分数解释注意事项

| 注意事项 | 说明 |
|----------|------|
| 相对性 | 分数用于排序，不是绝对置信度 |
| 研究偏倚 | 研究充分的疾病分数更高 |
| 不预测成功率 | 高分不代表临床一定会成功 |
| 低分不等于无效 | 新兴疾病/孤儿病证据可能较少 |

### 分数阈值参考

| 分数范围 | 解释 |
|----------|------|
| > 0.7 | 强证据，多个独立数据源支持 |
| 0.4-0.7 | 中等证据，值得进一步考察 |
| 0.2-0.4 | 弱证据，需谨慎评估 |
| < 0.2 | 初步线索，不建议单独依赖 |

## 可成药性评估 (Tractability)

### 评估维度

| 模态 | 小分子 | 抗体 | PROTAC | 其他 |
|------|--------|------|--------|------|
| **分类** | Small molecule | Antibody | Proteolysis targeting | 其他新兴技术 |

### 可成药性等级

1. **Clinical Precedence**: 已有批准或临床阶段药物
2. **Discovery Precedence**: 已有化学探针或工具化合物
3. **Predicted Tractable**: 计算预测可成药
4. **No Tractable Evidence**: 无可成药性证据

### 小分子可成药性要素

- **有配体结构**: PDB 中存在配体结合结构
- **结构域特征**: 含有已知可成药结构域 (激酶、GPCR 等)
- **理化性质**: 预测的结合位点性质

## 安全性评估 (Safety)

### 安全性 Liability 来源

| 数据源 | 内容 |
|--------|------|
| **Gene2Phenotype** | 基因-疾病关联 (致病变异) |
| **PhenoDigm** | 小鼠模型表型 |
| **ClinVar** | 临床致病变异 |
| **OMIM** | 遗传疾病关联 |

### 安全性红旗

| 红旗类型 | 含义 |
|----------|------|
| 致病基因 | 敲除导致严重疾病 |
| 高约束性 | pLI > 0.9 或 LOEUF < 0.35 |
| 广泛表达 | 在多种必需组织中高表达 |
| 多系统表型 | 影响多个器官系统 |

## 典型使用场景

### 场景 1: 靶点发现

**问题**: 疾病 X 有哪些潜在治疗靶点？

**查询流程**:
1. 搜索疾病获取 EFO ID
2. 获取疾病关联靶点列表
3. 按关联分数排序
4. 对高分靶点获取详细信息

### 场景 2: 靶点验证

**问题**: 基因 Y 是否是好的药物靶点？

**查询流程**:
1. 获取靶点完整信息
2. 检查可成药性等级
3. 评估安全性风险
4. 查看相关疾病和已知药物

### 场景 3: 药物重定位

**问题**: 已批准药物能否用于疾病 X？

**查询流程**:
1. 获取疾病的已知药物
2. 检查药物的作用机制
3. 查看药物的其他适应症
4. 评估临床阶段和状态

## 数据解释最佳实践

### 证据权重

1. **人类遗传学** (GWAS, 罕见变异) > 动物模型
2. **临床先例** (已知药物) > 计算预测
3. **专家审编** > 文本挖掘

### 优先级排序考虑

| 因素 | 权重 |
|------|------|
| 遗传证据强度 | 高 |
| 临床先例 | 高 |
| 可成药性 (Clinical) | 高 |
| 安全性风险 | 高 (负向) |
| 表达特异性 | 中 |
| 通路证据 | 中 |
| 文本挖掘 | 低 |

### 常见陷阱

| 陷阱 | 避免 |
|------|------|
| 仅依赖总分 | 查看证据类型分解 |
| 忽视研究偏倚 | 比较相似疾病的分数 |
| 高分 = 成功 | 分数仅用于排序 |
| 低分 = 无效 | 检查证据缺失原因 |
| 无视安全性 | 必须检查 safetyLiabilities |

## 解释限制

### 数据覆盖范围

- **非穷尽收录**: 仅收录有证据支持的靶点-疾病关联
- **证据质量差异**: 不同数据源的可靠性不同
- **时效性**: 新发表的证据可能尚未收录

### 分数局限性

- **排序工具**: 分数主要用于相对排序
- **研究偏倚**: 研究充分的疾病通常分数更高
- **不预测临床成功**: 高分不代表药物开发一定会成功

### 使用建议

- **多源验证**: 结合其他数据库验证关键发现
- **人工审查**: 对关键决策应查阅原始文献
- **动态更新**: 关注季度更新带来的变化

## 数据版本与引用

### 当前版本

- **平台版本**: 2025年10月发布
- **更新频率**: 季度更新
- **发布说明**: https://platform-docs.opentargets.org/release-notes

### 引用

使用 OpenTargets 数据时请引用:

> Ochoa, D. et al. (2025) Open Targets Platform: facilitating therapeutic hypotheses building in drug discovery. Nucleic Acids Research, 53(D1):D1467-D1477.
