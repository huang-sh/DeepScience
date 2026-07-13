#!/usr/bin/env python3
"""
Open Targets Platform GraphQL Query Helper

This script provides reusable functions for querying the Open Targets Platform
GraphQL API. Use these functions to retrieve target, disease, drug, and
association data.

Dependencies: requests (pip install requests)
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any

import requests

# API endpoint
BASE_URL = "https://api.platform.opentargets.org/api/v4/graphql"


def execute_query(query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Execute a GraphQL query against the Open Targets Platform API.

    Args:
        query: GraphQL query string
        variables: Optional dictionary of variables for the query

    Returns:
        Dictionary containing the API response data

    Raises:
        Exception if the API request fails or returns errors
    """
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    try:
        response = requests.post(BASE_URL, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()

        if "errors" in data:
            raise Exception(f"GraphQL errors: {data['errors']}")

        return data.get("data", {})

    except requests.exceptions.RequestException as e:
        detail = e.response.text[:2000] if e.response is not None else ""
        raise Exception(f"API request failed: {str(e)}{f': {detail}' if detail else ''}")


def search_entities(query_string: str, entity_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Search for targets, diseases, or drugs by name or identifier.

    Args:
        query_string: Search term (e.g., "BRCA1", "alzheimer", "aspirin")
        entity_types: Optional list to filter by entity type ["target", "disease", "drug"]

    Returns:
        List of search results with id, name, entity type, and description
    """
    query = """
      query search($queryString: String!, $entityNames: [String!]) {
        search(queryString: $queryString, entityNames: $entityNames, page: {index: 0, size: 10}) {
          hits {
            id
            entity
            name
            description
          }
        }
      }
    """

    variables = {"queryString": query_string}
    if entity_types:
        variables["entityNames"] = entity_types

    result = execute_query(query, variables)
    return result.get("search", {}).get("hits", [])


def get_target_info(ensembl_id: str, include_diseases: bool = False) -> Dict[str, Any]:
    """
    Retrieve comprehensive information about a target gene.

    Args:
        ensembl_id: Ensembl gene ID (e.g., "ENSG00000157764")
        include_diseases: Whether to include top associated diseases

    Returns:
        Dictionary with target information including tractability, safety, expression
    """
    disease_fragment = """
      associatedDiseases(page: {index: 0, size: 10}) {
        rows {
          disease {
            id
            name
          }
          score
          datatypeScores {
            id
            score
          }
        }
      }
    """ if include_diseases else ""

    query = f"""
      query targetInfo($ensemblId: String!) {{
        target(ensemblId: $ensemblId) {{
          id
          approvedSymbol
          approvedName
          biotype
          functionDescriptions

          tractability {{
            label
            modality
            value
          }}

          safetyLiabilities {{
            event
            effects {{
              dosing
              organsAffected
            }}
            biosamples {{
              tissue {{
                label
              }}
            }}
          }}

          geneticConstraint {{
            constraintType
            score
            exp
            obs
          }}

          {disease_fragment}
        }}
      }}
    """

    result = execute_query(query, {"ensemblId": ensembl_id})
    return result.get("target", {})


def get_disease_info(efo_id: str, include_targets: bool = False) -> Dict[str, Any]:
    """
    Retrieve information about a disease.

    Args:
        efo_id: EFO disease identifier (e.g., "EFO_0000249")
        include_targets: Whether to include top associated targets

    Returns:
        Dictionary with disease information
    """
    target_fragment = """
      associatedTargets(page: {index: 0, size: 10}) {
        rows {
          target {
            id
            approvedSymbol
            approvedName
          }
          score
          datatypeScores {
            id
            score
          }
        }
      }
    """ if include_targets else ""

    query = f"""
      query diseaseInfo($efoId: String!) {{
        disease(efoId: $efoId) {{
          id
          name
          description
          therapeuticAreas {{
            id
            name
          }}
          synonyms {{
            terms
          }}
          {target_fragment}
        }}
      }}
    """

    result = execute_query(query, {"efoId": efo_id})
    return result.get("disease", {})


def get_target_disease_evidence(ensembl_id: str, efo_id: str,
                                  data_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Retrieve evidence linking a target to a disease.

    Args:
        ensembl_id: Ensembl gene ID
        efo_id: EFO disease identifier
        data_types: Optional filter for evidence types (e.g., ["genetic_association", "known_drug"])

    Returns:
        List of evidence records with scores and sources
    """
    query = """
      query evidences($ensemblId: String!, $efoId: String!, $dataTypes: [String!]) {
        disease(efoId: $efoId) {
          evidences(ensemblIds: [$ensemblId], datatypes: $dataTypes, size: 100) {
            rows {
              datasourceId
              datatypeId
              score
              targetFromSourceId
              studyId
              literature
              cohortPhenotypes
            }
          }
        }
      }
    """

    variables = {"ensemblId": ensembl_id, "efoId": efo_id}
    if data_types:
        variables["dataTypes"] = data_types

    result = execute_query(query, variables)
    return result.get("disease", {}).get("evidences", {}).get("rows", [])


def get_known_drugs_for_disease(efo_id: str) -> Dict[str, Any]:
    """
    Get drugs known to be used for a disease.

    Args:
        efo_id: EFO disease identifier

    Returns:
        Dictionary with drug information including phase, targets, and status
    """
    query = """
      query knownDrugs($efoId: String!) {
        disease(efoId: $efoId) {
          knownDrugs {
            uniqueDrugs
            uniqueTargets
            rows {
              drug {
                id
                name
                drugType
                maximumClinicalTrialPhase
              }
              targets {
                id
                approvedSymbol
              }
              phase
              status
              mechanismOfAction
            }
          }
        }
      }
    """

    result = execute_query(query, {"efoId": efo_id})
    return result.get("disease", {}).get("knownDrugs", {})


def get_drug_info(chembl_id: str) -> Dict[str, Any]:
    """
    Retrieve information about a drug.

    Args:
        chembl_id: ChEMBL identifier (e.g., "CHEMBL25")

    Returns:
        Dictionary with drug information
    """
    query = """
      query drugInfo($chemblId: String!) {
        drug(chemblId: $chemblId) {
          id
          name
          synonyms
          drugType
          maximumClinicalTrialPhase
          hasBeenWithdrawn
          withdrawnNotice {
            reasons
            countries
          }
          mechanismsOfAction {
            actionType
            mechanismOfAction
            targetName
            targets {
              id
              approvedSymbol
            }
          }
          indications {
            disease
            efoId
            maxPhaseForIndication
          }
        }
      }
    """

    result = execute_query(query, {"chemblId": chembl_id})
    return result.get("drug", {})


def get_target_associations(ensembl_id: str, min_score: float = 0.0) -> List[Dict[str, Any]]:
    """
    Get all disease associations for a target, filtered by minimum score.

    Args:
        ensembl_id: Ensembl gene ID
        min_score: Minimum association score (0-1) to include

    Returns:
        List of disease associations with scores
    """
    query = """
      query targetAssociations($ensemblId: String!) {
        target(ensemblId: $ensemblId) {
          associatedDiseases(page: {index: 0, size: 100}) {
            count
            rows {
              disease {
                id
                name
              }
              score
              datatypeScores {
                id
                score
              }
            }
          }
        }
      }
    """

    result = execute_query(query, {"ensemblId": ensembl_id})
    associations = result.get("target", {}).get("associatedDiseases", {}).get("rows", [])

    # Filter by minimum score
    return [assoc for assoc in associations if assoc.get("score", 0) >= min_score]


def resolve_target(identifier: str) -> Dict[str, Any]:
    if identifier.upper().startswith("ENSG"):
        target = get_target_info(identifier)
        if not target:
            raise ValueError(f"Open Targets target not found: {identifier}")
        return {"id": identifier, "name": target.get("approvedSymbol", identifier)}
    hits = search_entities(identifier, entity_types=["target"])
    exact = [hit for hit in hits if str(hit.get("name", "")).casefold() == identifier.casefold()]
    candidates = exact or hits
    if not candidates:
        raise ValueError(f"Open Targets target not found: {identifier}")
    return candidates[0]


def write_result(payload: Dict[str, Any], output: Optional[Path]) -> None:
    rendered = json.dumps(payload, indent=2, ensure_ascii=False)
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(f"{rendered}\n", encoding="utf-8")
    print(rendered)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Query the Open Targets Platform GraphQL API")
    root.add_argument("--output", type=Path, help="write JSON to a Session workspace path")
    commands = root.add_subparsers(dest="action", required=True)

    search = commands.add_parser("search", help="search targets, diseases, or drugs")
    search.add_argument("query")
    search.add_argument("--entity", choices=("target", "disease", "drug"))
    search.add_argument("--limit", type=int, default=10)

    associations = commands.add_parser("associations", help="get top disease associations for a target")
    associations.add_argument("target", help="gene symbol or Ensembl Gene ID")
    associations.add_argument("--limit", type=int, default=10)
    associations.add_argument("--min-score", type=float, default=0.0)
    return root


def main() -> int:
    args = parser().parse_args()
    retrieved_at = datetime.now(timezone.utc).isoformat()
    if args.action == "search":
        entity_types = [args.entity] if args.entity else None
        records = search_entities(args.query, entity_types=entity_types)[: max(1, args.limit)]
        payload = {
            "source": BASE_URL,
            "retrieved_at": retrieved_at,
            "query": args.query,
            "entity": args.entity,
            "count": len(records),
            "records": records,
        }
    else:
        target = resolve_target(args.target)
        associations = get_target_associations(target["id"], args.min_score)[: max(1, args.limit)]
        payload = {
            "source": BASE_URL,
            "retrieved_at": retrieved_at,
            "target": {"id": target["id"], "name": target.get("name")},
            "count": len(associations),
            "associations": associations,
        }
    write_result(payload, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
