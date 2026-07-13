# FDA 参考文档

## 数据库概述

**openFDA** 是美国 FDA 的开放数据计划，提供免费的 API 访问 FDA 公开数据集，包括药物、医疗器械、食品、烟草和兽药产品等监管数据。

- **官网**: https://open.fda.gov/
- **API 基础 URL**: https://api.fda.gov
- **数据更新**: 定期更新
- **API 密钥**: 可选（使用后限制更宽松）

## 访问方式

**通过 skill 访问**: 使用 `fda-database` skill 进行查询

```bash
# 调用 skill
fda-database
```

**API 密钥**:
- **无需密钥**: 240 请求/分钟, 1,000 请求/天
- **使用密钥**: 240 请求/分钟, 120,000 请求/天
- **注册地址**: https://open.fda.gov/apis/authentication/

**直接 API 访问**:
```bash
# 浏览器直接访问
https://api.fda.gov/drug/event.json?search=reactionmeddrapt:"headache"&limit=5
```

## API 端点总览

### Drugs (药物)

| 端点 | 数据量 | 状态 | 描述 |
|------|--------|------|------|
| `drug/event.json` | ~20M | ✓ | 药物不良事件 |
| `drug/label.json` | ~255K | ✓ | 药物标签/说明书 |
| `drug/ndc.json` | ~132K | ✓ | 国家药物代码目录 |
| `drug/enforcement.json` | ~17K | ✓ | 药物召回/执法报告 |

### Devices (医疗器械)

| 端点 | 数据量 | 状态 | 描述 |
|------|--------|------|------|
| `device/event.json` | ~24M | ✓ | 医疗器械不良事件 |
| `device/510k.json` | ~174K | ✓ | 510(k) 上市前通知 |
| `device/classification.json` | ~7K | ✓ | 医疗器械分类 |
| `device/enforcement.json` | ~38K | ✓ | 医疗器械召回/执法 |
| `device/recall.json` | ~57K | ✓ | 医疗器械召回详情 |
| `device/pma.json` | ~55K | ✓ | 上市前批准 (PMA) |
| `device/udi.json` | ~4.9M | ✓ | 唯一设备识别 |

### Foods (食品)

| 端点 | 数据量 | 状态 | 描述 |
|------|--------|------|------|
| `food/event.json` | ~148K | ✓ | 食品不良事件 |
| `food/enforcement.json` | ~28K | ✓ | 食品召回/执法 |

### Tobacco (烟草)

| 端点 | 数据量 | 状态 | 描述 |
|------|--------|------|------|
| `tobacco/problem.json` | ~1.3K | ✓ | 烟草产品问题 |

### 已弃用端点

| 端点 | 状态 |
|------|------|
| `drug/drugsatfda.json` | ✗ 404 |
| `animalandveterinary/event.json` | ✗ 已弃用 |

## 核心数据实体

### 1. 药物不良事件 (Drug Adverse Events)

**端点**: `drug/event.json`

**主要字段**:

| 字段 | 说明 |
|------|------|
| `safetyreportid` | 安全报告 ID |
| `receivedate` | 收到日期 |
| `serious` | 严重程度 (1=严重) |
| `patient` | 患者信息 |
| `patient.drug` | 药物信息 |
| `patient.reaction` | 不良反应 |

**查询示例**:
```
# 查询阿司匹林不良事件
drug/event.json?search=patient.drug.medicinalproduct:aspirin

# 查询严重不良事件
drug/event.json?search=serious:1

# 按反应计数
drug/event.json?search=...&count=patient.reaction.reactionmeddrapt.exact
```

### 2. 药物标签 (Drug Labeling)

**端点**: `drug/label.json`

**主要字段**:

| 字段 | 说明 |
|------|------|
| `openfda.brand_name` | 品牌名称 |
| `openfda.generic_name` | 通用名称 |
| `openfda.manufacturer_name` | 制造商 |
| `warnings` | 警告信息 |
| `indications_and_usage` | 适应症 |
| `adverse_reactions` | 不良反应 |

**查询示例**:
```
# 按品牌名查询
drug/label.json?search=openfda.brand_name:lipitor

# 按通用名查询
drug/label.json?search=openfda.generic_name:atorvastatin
```

### 3. 医疗器械不良事件 (Device Events)

**端点**: `device/event.json`

**主要字段**:

| 字段 | 说明 |
|------|------|
| `report_number` | 报告编号 |
| `product_problem_code` | 产品问题代码 |
| `product.brand_name` | 品牌 |
| `product.problemdescription` | 问题描述 |

### 4. 510(k) 上市前通知

**端点**: `device/510k.json`

**主要字段**:

| 字段 | 说明 |
|------|------|
| `k_number` | K 编号 |
| `applicant` | 申请人 |
| `device_name` | 设备名称 |
| `decision_date` | 决定日期 |

### 5. 食品召回 (Food Enforcement)

**端点**: `food/enforcement.json`

**主要字段**:

| 字段 | 说明 |
|------|------|
| `classification` | 分类 (I/II/III) |
| `product_description` | 产品描述 |
| `reason_for_recall` | 召回原因 |
| `recall_initiation_date` | 召回开始日期 |

## 搜索语法

### 基本搜索

```
search=field:term
```

### 常用模式

| 模式 | 示例 | 说明 |
|------|------|------|
| 精确匹配 | `patient.drug.medicinalproduct:aspirin` | 精确字段搜索 |
| 短语匹配 | `reactionmeddrapt:"headache"` | 使用引号 |
| 通配符 | `patient.drug.medicinalproduct:*aspirin*` | 模糊匹配 |
| AND | `field:term1+AND+field:term2` | 同时满足 |
| OR | `field:(term1+term2)` | 任一满足 |
| NOT | `field:term1+AND+NOT+field:term2` | 排除 |
| 日期范围 | `receivedate:[20200101+TO+20201231]` | 日期范围 |

### 分组和排序

```
# 跳过前 100 条，取下一批
limit=100&skip=100

# 按字段计数
count=patient.reaction.reactionmeddrapt.exact

# 多字段计数
count=field1.exact+count=field2.exact
```

## 典型使用场景

### 场景 1: 药物安全性分析

```python
# 获取阿司匹林的安全性概况
# 1. 总不良事件数
drug/event.json?search=patient.drug.medicinalproduct:aspirin&limit=1

# 2. 最常见反应
drug/event.json?search=patient.drug.medicinalproduct:aspirin&count=patient.reaction.reactionmeddrapt.exact

# 3. 严重事件
drug/event.json?search=patient.drug.medicinalproduct:aspirin+AND+serious:1
```

### 场景 2: 医疗器械监测

```python
# 查询特定设备的不良事件
device/event.json?search=product.brand_name:medtronic

# 查找 510(k) 批准
device/510k.json?search=applicant:boston+scientific

# 检查召回
device/enforcement.json?search=classification:Class+I
```

### 场景 3: 食品安全监控

```python
# 查询过敏原召回
food/enforcement.json?search=reason:"undeclared peanut"

# 监控污染事件
food/enforcement.json?search=reason:listeria
```

### 场景 4: 趋势分析

```python
# 按日期范围分析
drug/event.json?search=patient.drug.medicinalproduct:aspirin+AND+receivedate:[20240101+TO+20241231]
```

## 速率限制

| 场景 | 限制 |
|------|------|
| 无 API 密钥 | 240 请求/分钟, 1,000 请求/天 |
| 有 API 密钥 | 240 请求/分钟, 120,000 请求/天 |

**注意**: 超出限制将返回 429 错误。

## 响应结构

所有 API 响应遵循以下结构:

```json
{
  "meta": {
    "disclaimer": "...",
    "results": {
      "skip": 0,
      "limit": 100,
      "total": 15234
    }
  },
  "results": [
    // 结果对象数组
  ]
}
```

## 数据解释注意事项

### 数据覆盖范围

- **非穷尽收录**: 仅包含向 FDA 提交的报告
- **报告偏倚**: 不同产品的报告率差异很大
- **时效性**: 最新报告可能尚未收录

### 数据质量

- **自愿报告**: 不良事件多数为自愿报告
- **因果关系**: 报告不证明因果关系
- **缺失字段**: 并非所有记录都包含所有字段

### 使用建议

- **多源验证**: 与其他数据源交叉验证
- **统计分析**: 注意报告偏倚
- **临床判断**: 需结合临床专业知识

## 与其他资源的比较

| 资源 | 专注领域 | 与 FDA 的关系 |
|------|----------|---------------|
| **OpenTargets** | 靶点-疾病关联 | FDA 提供监管/安全数据 |
| **ChEMBL** | 生物活性分子 | FDA 提供临床/监管数据 |
| **DrugBank** | 药物详细数据 | FDA 提供实际监管批准信息 |

## 数据下载

开放 FDA 也提供批量数据下载:
- **Drug Adverse Events**: FAERS 数据
- **Device Adverse Events**: MAUDE 数据
- **Enforcement Reports**: 召回数据

下载地址: https://open.fda.gov/data/

## 引用

使用 openFDA 数据时:

> openFDA is an FDA initiative. Data sourced from FDA datasets.

## 额外资源

- **openFDA 主页**: https://open.fda.gov/
- **API 文档**: https://open.fda.gov/apis/
- **API 测试工具**: https://open.fda.gov/apis/try-the-api/
- **GitHub**: https://github.com/FDA/openfda
- **服务条款**: https://open.fda.gov/terms/
