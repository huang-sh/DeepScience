# Reactome 参考文档

## 数据库概述

**Reactome** 是一个免费、开源、经过专家审编的生物学通路数据库，提供人类和其他生物体的信号传导和代谢过程详细信息。

- **官网**: https://reactome.org/
- **当前版本**: 不在本文档中硬编码；运行 `python3 <resource-dir>/scripts/reactome_query.py version` 查询
- **数据更新**: 季度更新
- **覆盖范围**: ~2,825 条人类通路, ~16,002 反应, ~11,630 蛋白质

## 访问方式

**通过 Resource 访问**: 加载 `biomarker-reactome` Resource 后，使用其受限查询脚本

```bash
python3 <resource-dir>/scripts/reactome_query.py version
python3 <resource-dir>/scripts/reactome_query.py search apoptosis --species "Homo sapiens" --limit 10
```

**API 访问**:
- **Content Service**: `https://reactome.org/ContentService` - 数据检索
- **Analysis Service**: `https://reactome.org/AnalysisService` - 通路分析

## 核心数据实体

### 1. 通路 (Pathway)

**标识符**: Reactome Stable ID（如 `R-HSA-109581` 对应 Apoptosis）

**主要注释字段**:

| 字段类别 | 字段名 | 说明 |
|----------|--------|------|
| **基础信息** | `stId` | 稳定标识符 |
| | `displayName` | 显示名称 |
| | `name` | 通路名称 |
| | `dbId` | 数据库 ID |
| **分类** | `category` | 通路类别 |
| **物种** | `speciesName` | 物种名称 |
| **类型** | `schemaClass` | 实体类型 (Pathway, Reaction 等) |

### 2. 反应 (Reaction)

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `stId` | 稳定标识符 |
| `displayName` | 反应名称 |
| `reactionType` | 反应类型 |
| `input` | 输入分子 |
| `output` | 输出分子 |
| `catalystActivity` | 催化活性 |
| `regulator` | 调节因子 |

### 3. 实体 (Physical Entity)

`reactome_query.py participants` 返回 PhysicalEntity 列表，不是基因列表。需要生成成员集或
统计数量时，必须先阅读 [`participants-schema.md`](./participants-schema.md)，并根据嵌套的
`refEntities[].schemaClass` 和 `identifier` 区分 UniProt、ChEBI、治疗实体与 isoform。

请求通路 gene set 时，使用 `reactome_query.py gene-set` 和
[`gene-set-schema.md`](./gene-set-schema.md)。该分支直接读取 Reactome 官方 pathway gene-set
导出，不经过 PhysicalEntity 或 `displayName` 转换。

**主要字段**:

| 字段名 | 说明 |
|--------|------|
| `stId` | 稳定标识符 |
| `displayName` | 显示名称 |
| `schemaClass` | 实体类型 |
| `name` | 名称 |
| `refEntities` | 嵌套的 ReferenceEntity 列表；原生标识符位于每项的 `identifier` |

## API 端点

### Content Service - 数据检索

**基础端点**:
```
GET /data/database/version     # 获取数据库版本
GET /data/database/name        # 获取数据库名称
```

**查询端点**:
```
GET /data/query/{id}                        # 查询实体
GET /data/query/{id}/{attribute}            # 查询特定属性
GET /data/participants/{id}                         # 递归获取通路或反应参与者
GET /data/search/{term}                     # 搜索
```

此 endpoint 的实际响应契约和成员计数定义见
[`participants-schema.md`](./participants-schema.md)。不要将顶层 PhysicalEntity 数量直接解释为
基因数。

### Analysis Service - 通路分析

**富集分析**:
```
POST /identifiers/         # 基因列表富集分析
POST /identifiers/projection/  # 物种投影分析
GET  /token/{token}         # 通过 Token 获取结果
```

## 典型使用场景

### 场景 1: 通路查询

**问题**: 获取特定通路的详细信息

**查询流程**:
1. 使用通路 ID 查询
2. 获取通路详情
3. 查看参与分子
4. 探索层级结构

若目标是该通路的 gene-symbol set，使用 `gene-set <stable-id>`；仅在目标是物理组成时获取
participants。

**API 示例**:
```python
import requests

# 查询通路
url = "https://reactome.org/ContentService/data/query/R-HSA-109582"
response = requests.get(url)
pathway = response.json()

print(f"通路: {pathway['displayName']}")
```

### 场景 2: 基因富集分析

**问题**: 基因列表在哪些通路中富集？

**查询流程**:
1. 准备基因列表
2. 提交分析请求
3. 获取 Token
4. 查看富集结果

**API 示例**:
```python
import requests

genes = ["TP53", "BRCA1", "EGFR", "MYC"]
data = "\n".join(genes)

url = "https://reactome.org/AnalysisService/identifiers/"
headers = {"Content-Type": "text/plain"}

response = requests.post(url, headers=headers, data=data)
result = response.json()

token = result["summary"]["token"]
for pathway in result["pathways"][:10]:
    print(f"{pathway['stId']}: {pathway['name']} (p={pathway['entities']['pValue']})")
```

### 场景 3: 基因到通路映射

**问题**: 某基因参与哪些通路？

**查询流程**:
1. 使用 UniProt ID 或基因符号搜索
2. 获取相关通路列表
3. 查看通路详情

### 场景 4: 物种比较

**问题**: 不同物种间通路差异？

**查询流程**:
1. 使用 projection 端点
2. 将其他物种基因映射到人类通路
3. 比较通路保守性

## 支持的标识符类型

| 类型 | 示例 | 说明 |
|------|------|------|
| UniProt 登录号 | P04637 | 蛋白质标识符 |
| 基因符号 | TP53 | 基因名称 |
| Ensembl ID | ENSG00000141510 | 基因组标识符 |
| EntrezGene ID | 7157 | NCBI 基因 ID |
| ChEBI ID | 小分子 ID | 化学实体标识符 |

## 分析结果解释

### 富集分析指标

| 指标 | 说明 |
|------|------|
| `pValue` | P 值 (统计显著性) |
| `fdr` | 错误发现率 |
| `entities.pValue` | P 值 |
| `entities.fdr` | FDR |
| `entitiesFound` | 找到的实体数 |
| `entitiesTotal` | 总实体数 |

### 结果解释注意事项

- **P 值越小**: 通路越显著
- **FDR < 0.05**: 通常认为显著
- **覆盖度**: 考虑通路中基因的覆盖比例
- **物种匹配**: 确认分析物种正确

## 数据覆盖范围

### 人类数据
- 2,825 条通路
- 11,630 种蛋白质
- 2,176 种小分子

### 跨物种数据
- 20+ 个物种
- 小鼠、大鼠、斑马鱼等模式生物

### 数据质量
- 专家审编
- 文献引用支持 (41,000+ 参考文献)
- 定期更新

## 解释限制

### 数据覆盖范围

- **非穷尽收录**: 仅包含已审编的通路
- **偏倚**: 研究充分的通路更详细
- **时效性**: 新发现的通路可能尚未收录

### 分析限制

- **背景集选择**: 分析结果受背景集影响
- **多重检验**: 大规模分析需考虑多重检验校正
- **基因集大小**: 基因集过小或过大影响统计效力

### 使用建议

- **验证结果**: 结合多个数据库验证
- **文献支持**: 查阅原始文献
- **专业知识**: 需要领域知识解释结果

## 引用

使用 Reactome 数据时请引用:

> Gillespie, M. et al. (2022) Reactome pathway analysis as a platform for in-depth exploration of omics data. Nucleic Acids Research, 50(W1), W585-W592.
> Griss, J. et al. (2021) Reactome: identifying pathways, processes and connections in biological systems. Nucleic Acids Research, 49(D1): D1313-D1321.

## 额外资源

- **Reactome 主页**: https://reactome.org/
- **API 文档**: https://reactome.org/dev
- **用户指南**: https://reactome.org/userguide
- **Pathway Browser**: https://reactome.org/PathwayBrowser/
- **数据下载**: https://reactome.org/download-data
