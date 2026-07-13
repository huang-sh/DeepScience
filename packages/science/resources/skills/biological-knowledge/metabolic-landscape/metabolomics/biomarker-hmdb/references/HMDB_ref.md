# HMDB 参考文档

## 数据库概述

**Human Metabolome Database (HMDB)** 是一个包含人体小分子代谢物详细信息的综合资源，涵盖水溶性和脂溶性化合物。

- **官网**: https://www.hmdb.ca/
- **当前版本**: v5.0 (2023年7月)
- **数据更新**: 定期更新
- **覆盖范围**: ~220,945 代谢物, ~8,610 蛋白质 (酶/转运蛋白)

## 访问方式

**通过 skill 访问**: 使用 `hmdb-database` skill 进行查询

```bash
# 调用 skill
hmdb-database
```

**其他访问方式**:
- **Web 界面**: https://www.hmdb.ca/
- **数据下载**: https://www.hmdb.ca/downloads
- **R 包**: `hmdbQuery` (Bioconductor)
- **API**: 联系 eponome@ualberta.ca (学术用)

## 核心数据实体

### 1. 代谢物 (Metabolite)

**标识符**: HMDB ID (如 `HMDB0000001` for Water, `HMDB0000059` for Glucose)

**主要注释字段**:

| 字段类别 | 字段名 | 说明 |
|----------|--------|------|
| **基础信息** | `accession` | HMDB ID |
| | `name` | 系统名称 |
| | `synonyms` | 同义词列表 |
| **化学性质** | `chemical_formula` | 分子式 |
| | `average_molecular_weight` | 分子量 |
| | `smiles` | SMILES 字符串 |
| | `inchi` | InChI 标识符 |
| | `iupac_name` | IUPAC 名称 |
| **生物学** | `pathways` | 代谢通路 |
| | `enzymes` | 相关酶 |
| | `transporters` | 转运蛋白 |
| | `cellular_locations` | 细胞内位置 |
| **临床数据** | `normal_concentrations` | 正常浓度范围 |
| | `abnormal_concentrations` | 异常浓度 |
| | `biomarker_associations` | 生物标志物关联 |
| | `diseases` | 相关疾病 |
| **谱图数据** | `nmr_spectra` | NMR 谱图 |
| | `ms_spectra` | 质谱数据 |
| | `msms_spectra` | MS-MS 谱图 |

### 2. 蛋白质/酶 (Protein/Enzyme)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `protein_accession` | 蛋白质 ID |
| `gene_name` | 基因名称 |
| `protein_name` | 蛋白质名称 |
| `uniprot_id` | UniProt 标识符 |

## 数据类型

### 1. 化学信息

- **结构**: 2D/3D 结构, SMILES, InChI, MOL 文件
- **性质**: 分子量, LogP, 氢键, 极性表面积
- **分类**: 化学分类, 化学 taxonomy

### 2. 生物学信息

- **代谢通路**: KEGG, MetaCyc, SMPDB
- **酶反应**: 参与的酶和反应
- **转运蛋白**: 膜转运蛋白
- **位置**: 细胞位置, 生物标本位置

### 3. 临床数据

- **浓度**: 各生物体液中的正常/异常浓度
- **生物标志物**: 疾病关联的生物标志物
- **疾病**: 相关疾病列表
- **毒性**: 毒性信息 (如适用)

### 4. 谱图数据

- **NMR**: 实验和预测的 1H/13C NMR 谱图
- **MS**: LC-MS, GC-MS 谱图
- **MS-MS**: 串联质谱碎片数据
- **色谱**: 保留时间数据

## 典型使用场景

### 场景 1: 代谢物鉴定

**问题**: 识别未知代谢物

**查询流程**:
1. 使用 HMDB ID、名称或同义词搜索
2. 验证分子量
3. 比对质谱或 NMR 谱图
4. 检查生物学合理性 (标本类型)

### 场景 2: 生物标志物发现

**问题**: 找到疾病相关的代谢物

**查询流程**:
1. 按疾病搜索代谢物
2. 查看正常 vs 疾病浓度
3. 识别差异丰度代谢物
4. 检查通路背景

### 场景 3: 通路分析

**问题**: 理解代谢物的生物学背景

**查询流程**:
1. 获取代谢物信息
2. 提取通路关联
3. 使用 SMPDB 获取通路图
4. 识别通路富集

### 场景 4: 数据库整合

**问题**: 与其他数据库链接

**查询流程**:
1. 下载 HMDB 数据 (XML/CSV)
2. 解析外部 ID (KEGG, PubChem, ChEBI)
3. 建立跨数据库链接
4. 构建本地工具

## 外部数据库链接

| 数据库 | 用途 |
|--------|------|
| **KEGG** | 代谢通路和酶信息 |
| **PubChem** | 化学结构 |
| **MetaCyc** | 代谢通路 |
| **ChEBI** | 化学实体 |
| **PDB** | 蛋白质结构 |
| **UniProt** | 蛋白质序列 |
| **GenBank** | 基因序列 |
| **SMPDB** | 小分子通路图 |

## HMDB 生态系统

| 数据库 | 内容量 | 说明 |
|--------|--------|------|
| **HMDB** | 220,945 | 人类代谢物 |
| **DrugBank** | 2,832 | 药物化合物 |
| **T3DB** | 3,670 | 毒性化合物 |
| **SMPDB** | - | 小分子通路图 |
| **FooDB** | 70,000 | 食物成分 |

## 数据下载

### 可用格式

| 格式 | 用途 |
|------|------|
| **XML** | 完整数据，包含所有字段 |
| **SDF** | 分子结构，用于化学信息学 |
| **FASTA** | 蛋白质和基因序列 |
| **TXT** | 原始谱图峰值 |
| **CSV/TSV** | 表格数据导出 |

### 数据集类别

- 全部代谢物
- 按标本类型 (urine, serum, csf, saliva, feces, sweat)
- 蛋白质序列
- 实验谱图
- 预测谱图

## 解释限制

### 数据覆盖范围

- **非穷尽收录**: 人体代谢物在不断发现中
- **质量差异**: 实验数据 > 预测数据
- **标本差异**: 不同标本中浓度差异大

### 浓度数据

- **参考范围**: 正常浓度因年龄、性别、饮食而异
- **单位差异**: 注意单位转换
- **检测方法**: 不同方法检测结果可能不同

### 使用建议

- **多源验证**: 与其他代谢物数据库交叉验证
- **实验条件**: 注意实验条件对浓度的影响
- **版本控制**: 记录使用的 HMDB 版本

## 生物标本类型

| 标本 | 说明 |
|------|------|
| **血清/血浆** | 血液代谢物的主要来源 |
| **尿液** | 代谢终产物 |
| **脑脊液** | 中枢神经系统代谢物 |
| **唾液** | 口腔和全身代谢物 |
| **粪便** | 肠道微生物代谢物 |
| **汗液** | 皮肤代谢物 |

## 许可和引用

### 数据使用

- **学术研究**: 免费
- **商业使用**: 需要明确许可 (联系 samackay@ualberta.ca)
- **引用**: 使用数据时必须引用

### 引用

使用 HMDB 数据时请引用:

> Wishart DS, Feunang YD, Marcu A, et al. HMDB 5.0: The Human Metabolome Database in 2023. Nucleic Acids Research. 2023;51(D1):D537-D547.

## 额外资源

- **HMDB 网站**: https://www.hmdb.ca/
- **下载页**: https://www.hmdb.ca/downloads
- **HMDB 帮助**: https://www.hmdb.ca/help
- **SMPDB**: https://smpdb.ca/
