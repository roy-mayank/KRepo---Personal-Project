### KRepo

Find Documentation in the /documentation directory

##### Intended Positioning Statement

Positioning: For organisations managing high complexity systems, LC is an intelligent onboarding and maintenance LMS tool that turns long technical documentation and chief engineer knowledge into digestable, graph-based learning maps reducing the amount of time and effort engineers need to keep up.

### A Graph-Based RAG Framework for Technical Onboarding and Knowledge Retention

## 1. Research Overview

This project investigates the efficacy of **Retrieval-Augmented Generation (RAG)** combined with **Knowledge Graph (KG)** architectures to mitigate "Institutional Memory Loss" in high-complexity engineering environments. The core hypothesis is that transforming unstructured, multimodal technical data into a dynamic, navigable graph significantly reduces the cognitive load required for system mastery compared to traditional linear documentation.

## 2. Problem Statement

In large-scale technical organizations, critical system architecture is often "siloed" within the oral tradition of senior engineers or buried in dense, unindexed documentation. This creates a "Knowledge Bottleneck" that hinders onboarding efficiency. This research proposes an **Autonomous Knowledge Synthesis** pipeline to automate the extraction and visualization of these complex relationships.

## 3. Technical Architecture & Methodology

### Phase 1: Semantic Indexing & Grounding

- **Orchestration:** [LangChain](https://www.langchain.com/) for document preprocessing and recursive character splitting.
- **Vector Engine:** [Pinecone](https://www.pinecone.io/) for high-dimensional similarity searches.
- **Inference:** Claude-3-series wrapper for context-aware response generation.
- **Constraint:** Implementation of **Source-Anchored Grounding** to ensure 0% hallucination; every response is programmatically linked to a specific document coordinate (page/paragraph).

### Phase 2: Multimodal Extraction (STT)

- **Aural Processing:** Utilizing **OpenAI Whisper** to process recorded technical seminars, sprint reviews, and architectural deep-dives.
- **Entity-Relationship Extraction:** Developing custom prompts to output **Structured JSON** triplets (Subject-Predicate-Object) from transcripts, capturing the "hidden" logic of system dependencies.

### Phase 3: Knowledge Graph Visualization

- **Graph Engine:** [PyVis](https://pyvis.readthedocs.io/) and NetworkX for rendering interactive 2D/3D topologies.
- **Dynamic Learning Paths:** A specialized "Onboarding" module that generates individualized concept lists and prerequisite chains based on specific researcher roles or academic requirements.

---

## 4. Key Features (Experimental)

- **Deep-Dive Indexing:** Hierarchical navigation allowing researchers to move from high-level system overviews to niche technical sub-components.
- **Contextual Chatbot:** A grounded interface for querying the dataset with full transparency of source materials.
- **Progress Tracking:** A "Learning Path" generator that monitors the participant’s coverage of the knowledge graph.

## 5. Proposed Evaluation Metrics

To validate the effectiveness of the AKS framework, the following metrics will be tracked:

1.  **Retrieval Accuracy:** Precision and Recall of the RAG pipeline compared to standard keyword searches.
2.  **Cognitive Load Reduction:** Qualitative and quantitative analysis of time-to-information-retrieval among research participants.
3.  **Graph Fidelity:** The accuracy of the STT-to-JSON pipeline in identifying valid architectural relationships.

---

## 6. Future Work: Visual Documentation

Future iterations of this research will explore the integration of **Vision-capable LLMs** to interpret technical diagrams, flowcharts, and manual schematics, further enriching the Knowledge Graph's multimodal capabilities.

---

## 7. Setup & Installation (Local Research Environment)

```bash
# Clone the repository
git clone [https://github.com/your-username/aks-research.git](https://github.com/your-username/aks-research.git)

# Install dependencies
pip install langchain pinecone-client openai pyvis

# Configure environment variables
export PINECONE_API_KEY='your_key'
export OPENAI_API_KEY='your_key'
```
