# Phase 3 RAG Implementation Plan - YourHonor AI Legal Education Platform

## Executive Summary

This comprehensive implementation plan details the addition of Retrieval-Augmented Generation (RAG) capabilities to the YourHonor AI platform. The current system features a FastAPI backend with SQLite database, JWT-based authentication, and a placeholder chat endpoint at `/api/chat/message`. This plan specifies the complete architectural changes, dependencies, and implementation steps required to transform the chat system into a fully functional legal RAG assistant using Qdrant for vector storage and Sentence Transformers for embeddings, in accordance with the specifications outlined in AGENTS.md.

The implementation leverages the existing OPENROUTER_API_KEY and CEREBRAS_API_KEY already configured in the .env file, and follows the Docker-first development philosophy established in the project guidelines. The plan addresses the unique challenges of legal document processing, including specialized chunking strategies for case law and statutory text, hallucination prevention critical for legal AI applications, and citation accuracy requirements essential for educational use cases.

---

## 1. Required Components

### 1.1 Document Ingestion Pipeline

The document ingestion pipeline forms the foundation of the RAG system, responsible for loading legal documents from various sources and preparing them for embedding and storage. This pipeline must handle multiple file formats prevalent in legal environments, including PDF documents from court opinions and statutory compilations, DOCX files from legal briefs and memoranda, Markdown files from the existing templates directory, and plain text files for raw legal text.

The ingestion flow follows a sequential process beginning with source detection to identify whether documents are user-uploaded, preloaded legal corpus materials, or templates from the templates directory. Format detection then determines the file type and selects the appropriate extraction library. Text extraction converts document content to plain text, followed by a cleaning phase that removes formatting artifacts, normalizes whitespace, and handles special character encoding. The chunking phase splits documents into semantically coherent chunks optimized for legal retrieval, and finally the embedding phase generates vector embeddings for each chunk before storage in Qdrant.

The ingestion pipeline must support multiple document types including legal case opinions from court decisions, statutory text from the US Code and state laws, legal templates from the existing templates directory, user-uploaded legal documents for personalized RAG, and educational materials including legal guides, outlines, and bar exam preparation materials.

### 1.2 Text Extraction and Cleaning

Text extraction from legal documents presents unique challenges due to the complex formatting, structured sections, citations, footnotes, and specialized formatting common in legal materials. The extraction strategy must be format-specific to handle the variety of document types that will be processed.

For PDF documents, the primary extraction library is pypdf version 5.1.0, which provides reliable text extraction from standard PDF files. For scanned documents requiring OCR, pdfplumber version 0.11.4 provides additional capabilities for extracting text from images within PDFs. DOCX files are handled by python-docx version 1.1.2, which provides comprehensive Word document parsing. Plain text and Markdown files are processed using built-in Python capabilities.

The text cleaning pipeline implements several essential processing steps. Encoding normalization converts all text to UTF-8 and handles special characters common in legal documents. Whitespace normalization replaces multiple spaces and newlines with single instances to create clean, consistent text. Header and footer removal detects and removes page numbers and running headers that are not part of the document content. Citation extraction identifies and marks legal citations in standard formats such as "42 U.S.C. § 1983" or "Brown v. Board of Education, 347 U.S. 483 (1954)". Footnote handling either preserves footnotes as separate chunks or integrates them with their reference locations. Section boundary detection identifies headings in standard legal formats including Article I, Section 2, Part III, and Amendment V.

The text cleaning implementation includes encoding normalization using re.sub() patterns to replace multiple consecutive whitespace characters, citation detection using regex patterns for common legal citation formats, and legal abbreviation handling to preserve periods after standard legal abbreviations such as U.S., U.S.C., and F.2d.

### 1.3 Document Chunking Strategy for Legal Documents

Legal documents require specialized chunking strategies that respect legal semantics and preserve the context necessary for accurate retrieval. Standard chunking approaches that simply split on character counts often break important legal context, making retrieval ineffective and potentially introducing errors in legal research. The recommended chunking architecture for YourHonor AI combines multiple approaches in a tiered system.

The primary tier uses semantic section chunking that splits documents on legal document structure including Articles, Sections, Parts, Amendments, and other hierarchical divisions. Regex patterns detect common legal heading formats and preserve section numbers and titles as metadata attached to each chunk. This approach ensures that legal concepts remain intact and that retrieved chunks can be properly cited to specific sections of documents.

The secondary tier implements recursive character splitting as a fallback mechanism. When semantic chunks exceed the token limit, the system recursively splits using a hierarchy of separators prioritized as follows: double newlines, single newlines, sentence endings with periods, semicolons, single spaces, and finally individual characters. The chunk overlap parameter of 128 tokens preserves context across chunk boundaries, ensuring that split sections retain connecting context.

The third tier provides special handling for different document types. Contracts are split by defined terms, clauses, and exhibits. Case opinions are split by issues, holdings, and reasoning sections. Statutory text is split by sections, subsections, and paragraphs. This tiered approach ensures that each document type receives optimal chunking treatment based on its inherent structure.

The recommended chunking parameters specify a chunk size of 512 tokens to balance between providing sufficient context and maintaining retrieval precision, a chunk overlap of 128 tokens to preserve cross-chunk context, and the hierarchical separator list ["\n\n", "\n", ". ", "; ", " ", ""] for recursive splitting. The length function uses tiktoken with the cl100k_base encoding for accurate token counting, which is essential because chunk sizes must remain below the embedding model's maximum token limit.

The legal-specific chunking implementation creates a custom LegalTextSplitter class that extends RecursiveCharacterTextSplitter and adds legal metadata classification. The classifier identifies chunks as statutory (containing Article, Section, or Part keywords), case_opinion (containing Holding, Reasoning, or Facts keywords), contract (containing Whereas, Agreement, or Parties keywords), or general_legal for other legal content.

### 1.4 Embedding Generation with Sentence Transformers

The embedding model is the most critical component for retrieval quality. General-purpose embedding models often underperform on legal text due to the domain-specific vocabulary, citation patterns, and reasoning styles unique to legal discourse. Based on the research findings and the specifications in AGENTS.md, Sentence Transformers is the recommended library for embedding generation.

The model selection analysis considers multiple factors including embedding dimensions, maximum context length, legal domain performance, and cost. The all-MiniLM-L6-v2 model provides 384 dimensions with a 256-token context length and moderate legal performance as a good baseline option. The all-mpnet-base-v2 model provides 768 dimensions with a 384-token context length and good legal performance, also free to use. The paraphrase-multilingual-MiniLM-L12-v2 model provides 384 dimensions but with only 128-token context length, better suited for multilingual applications. The ms-marco-mpnet-base-v2 model provides 768 dimensions with 384-token context length and strong performance on retrieval tasks, trained specifically on the MS MARCO passage retrieval dataset.

The recommended primary model is ms-marco-mpnet-base-v2. This model was trained on MS MARCO, a retrieval-specific dataset that focuses on passage retrieval rather than general semantic similarity. The 768-dimensional embeddings provide a good balance between precision and storage requirements. The model's strong performance on passage retrieval tasks makes it particularly well-suited for legal document search where finding the most relevant passage is paramount. The model is free, open-source, and actively maintained by the Sentence Transformers community.

The embedding configuration uses HuggingFaceEmbeddings from LangChain with the model_name parameter set to "sentence-transformers/msmarco-mpnet-base-v2". The model_kwargs specifies 'device': 'cpu' for development, though this should be changed to 'cuda' when a GPU is available for significantly faster inference. The encode_kwargs sets normalize_embeddings to True, which normalizes all vectors to unit length, enabling efficient cosine similarity calculations through simple dot product operations.

The embedding dimensions are 768 floats (matching the ms-marco-mpnet-base-v2 output), and each embedding requires approximately 1KB of storage including the vector data and associated metadata. For a corpus of 1,000 legal documents averaging 50 chunks each, the total storage requirement would be approximately 50MB, which is quite manageable even for limited hardware.

### 1.5 Vector Database Setup with Qdrant

Qdrant is specified in AGENTS.md as the preferred vector database for the YourHonor AI platform. Qdrant provides excellent performance for vector similarity search, offers straightforward setup and configuration, and has strong integration support with Python and LangChain ecosystems. The database uses a client-server architecture that can run locally in a Docker container or be deployed to a cloud service.

The Qdrant configuration specifies the collection name as "legal_documents" for semantic clarity, the vector size as 768 to match the embedding dimensions from the ms-marco-mpnet-base-v2 model, and the distance metric as Cosine, which is standard for semantic search where the angle between vectors determines similarity rather than absolute distance. Optional scalar quantization can be enabled to reduce storage requirements if needed, though this may slightly impact accuracy.

The Docker setup adds a dedicated Qdrant service to docker-compose.yml using the official qdrant/qdrant:v1.7.0 image. The configuration exposes two ports: port 6333 for the REST API and port 6334 for the gRPC API (which provides faster performance for high-volume operations). A volume maps ./data/qdrant_storage to /qdrant/storage to persist the vector database across container restarts.

The Qdrant client configuration establishes a connection to the local instance. The create_collection_if_not_exists function checks whether the collection exists and creates it with the appropriate vector configuration if needed. The point structure includes a UUID for unique identification, the 768-dimensional embedding vector, and a payload containing document metadata including the document_id, chunk_index, text content, source_type, title, jurisdiction, date, and additional metadata fields.

The collection schema design supports filtering and faceted search capabilities. The source_type field enables filtering by document category (case_law, statute, template, user_upload). The jurisdiction field enables geographic filtering for state-specific legal materials. The date field enables temporal filtering to find only recent precedents or historical materials as needed.

### 1.6 Retrieval API Design

The Retrieval API provides the backend functionality for semantic search over the legal corpus. This API is called by the chat service to fetch relevant context for response generation, and it also provides endpoints for document management and collection statistics.

The RetrievalRequest model accepts a query string, a top_k parameter defaulting to 5 for the number of results to return, an optional filters dictionary for source_type or jurisdiction filtering, and a min_score parameter defaulting to 0.5 as the minimum similarity threshold to filter out irrelevant results. The RetrievalResponse model returns the list of retrieved chunks with scores, the original query, and the total number of results found.

The three primary endpoints are POST /api/rag/retrieve for semantic document search, POST /api/rag/ingest for adding new documents to the corpus, and GET /api/rag/collection/stats for retrieving collection statistics. Additional endpoints for bulk operations and index management may be added as needed.

The retrieval implementation generates an embedding for the user query using the EmbeddingService, searches Qdrant with the query embedding and any specified filters, applies the minimum score threshold to filter out low-quality matches, and returns the results sorted by relevance score.

### 1.7 Integration with Existing /api/chat/message Endpoint

The existing chat endpoint at /api/chat/message currently returns a placeholder response without any RAG functionality. This endpoint must be modified to perform retrieval, context assembly, LLM generation, and citation formatting.

The current implementation receives a ChatMessage with the user's query, calls the RetrievalService to find relevant documents, passes the retrieved documents to the ChatService for LLM generation, and returns the response along with citation information and retrieval metadata. The get_current_user_id dependency ensures that only authenticated users can access the chat functionality.

The modified implementation performs several key operations. First, it retrieves relevant documents using the RetrievalService with configurable top_k and min_score parameters. Second, it assembles context from the retrieved documents by extracting the text content from each result and formatting it for inclusion in the LLM prompt. Third, it calls the ChatService which builds a system prompt with instructions for legal education responses, constructs a user prompt containing the retrieved context and the user's question, and calls the LLM via OpenRouter with appropriate parameters including a low temperature of 0.3 for factual responses. Fourth, it extracts citation information from the retrieved documents to include in the response, enabling users to verify sources. Finally, it returns the response along with the sources array containing citation details, the retrieval metadata showing the number of documents found, and any error information if something fails.

---

## 2. Legal Data Sources

### 2.1 Public Domain Legal Documents

The RAG system requires preloaded legal documents to provide meaningful responses to student queries. Without a corpus of legal materials, the retrieval system would have no documents to search and the RAG pipeline would be ineffective. Public domain legal data is available from multiple authoritative sources, each with different characteristics, access methods, and data formats.

The CourtListener API from the Free Law Project provides access to millions of legal opinions from federal and state courts. The data includes Supreme Court opinions, circuit court decisions, district court opinions, and state supreme court decisions. Access is available via API with a free account or through bulk data downloads. The data format is JSON, making it easy to process and integrate. The recommended volume for initial loading is 100 to 500 cases, focusing on landmark decisions and commonly-cited precedents.

The Cornell Legal Information Institute (LII) provides free access to Supreme Court decisions, the US Constitution, the US Code, and other primary legal materials. Data is available via bulk download in XML and HTML formats. The recommended approach is to download the complete US Constitution and key statutory materials for foundational legal content.

The US Government Publishing Office (GPO) provides access to the US Code, the Code of Federal Regulations (CFR), and public laws through the govinfo.gov API. Data is available in XML format with comprehensive coverage of federal statutory and regulatory materials. Core titles from the US Code should be prioritized for initial loading.

The Harvard Caselaw Access Project provides historical case law data in JSON format, with particular strength in older historical cases. The recommended volume is 100 cases to provide historical perspective alongside modern precedents.

The templates directory contains the existing 11 legal document templates in Markdown format, including Mutual Non-Disclosure Agreement, Service Level Agreement, Professional Services Agreement, and others from the catalog.json file. These templates provide immediate content for the RAG system and demonstrate the document generation capabilities.

### 2.2 Data Acquisition Methods

The CourtListener API provides the most comprehensive source for case law. The acquisition process begins with obtaining an API key from CourtListener.com (free registration required), then using the courtlistener Python client to search and retrieve opinions. The code initializes the CourtListenerClient with the API key, executes searches with filters for court (such as "scotus" for Supreme Court), date range, and other parameters, processes the results to extract case names, full text, and metadata, and ingests the processed documents into the RAG system.

The Cornell LII bulk download provides efficient access to statutory materials. The acquisition process uses HTTP requests to download XML files from the Cornell LII website, parses the XML to extract articles, sections, and subsections, and ingests the parsed content into the RAG system.

Local template files from the templates directory provide the simplest acquisition path. The code iterates over all .md files in the templates directory, reads the content from each file, creates a document object with the template name and content, and ingests the template into the RAG system.

### 2.3 Initial Dataset Recommendations

The recommended Phase 3 launch dataset balances comprehensiveness with manageable size for initial deployment. The legal templates category includes all 11 templates from the templates directory, sourced from the local filesystem, and intended for document generation purposes. The constitutional law category includes the complete US Constitution from Cornell LII, sourced from the Cornell website, and intended for foundational legal education.

The case law categories include 20 contract law cases from CourtListener for contract formation and breach topics, 15 tort law cases from CourtListener for negligence and liability topics, and 15 criminal law cases from CourtListener for criminal procedure and constitutional criminal law topics. Each category pulls from the CourtListener API with appropriate topic filtering.

The total initial corpus of approximately 72 documents provides sufficient content for meaningful RAG queries while remaining manageable for initial testing and deployment. The Phase 4 expansion would add 500+ additional cases across all practice areas, include statutory text from key US Code titles, and add law review articles and legal guides for comprehensive coverage.

---

## 3. Integration Points

### 3.1 Docker Integration

The Docker integration requires modifications to both docker-compose.yml and the backend Dockerfile. The docker-compose.yml adds a new qdrant service with the official qdrant/qdrant:v1.7.0 image, exposes ports 6333 (REST) and 6334 (gRPC), creates a volume for persistent storage, and adds the service to the yourhonor-network network. The existing backend service is updated to add a depends_on relationship with qdrant to ensure proper startup order, environment variables for QDRANT_HOST and QDRANT_PORT, and network configuration to match the new qdrant service.

The Dockerfile.backend adds system dependencies for PDF processing including poppler-utils for PDF utilities, tesseract-ocr for OCR capabilities, and libpoppler-cpp-dev for Poppler development files. These dependencies are installed via apt-get in the Dockerfile before the Python environment is set up. The RAG dependencies are added to pyproject.toml in the dependencies list before uv sync is executed.

### 3.2 Backend Service Architecture

The backend service architecture introduces several new service files under the backend/app/services/ directory. The retrieval.py service provides the main RAG functionality by combining Qdrant search with embedding generation. The chat.py service handles LLM integration including prompt construction and response generation. The ingestion.py service manages document loading from various sources. The embeddings.py service wraps the Sentence Transformers model for embedding generation. The qdrant_store.py service provides a clean interface to Qdrant operations. The chunking.py service implements the legal-specific text splitting. The text_cleaning.py service provides text cleaning and normalization functions.

The API layer adds a new rag.py file under backend/app/api/ to provide RAG-specific endpoints separate from the chat functionality.

### 3.3 API Endpoint Changes

The modified endpoints include POST /api/chat/message which is updated to integrate RAG retrieval and LLM generation instead of returning the placeholder response. The GET /api/chat/greeting endpoint remains unchanged as it provides the initial greeting without requiring retrieval.

The new endpoints include POST /api/rag/retrieve for semantic search over documents, POST /api/rag/ingest for adding new documents to the corpus, GET /api/rag/collection/stats for collection statistics, and POST /api/rag/collection/rebuild for rebuilding the index from the corpus.

### 3.4 Database Schema Changes

The current SQLite schema remains unchanged for the core user and document tables. The users table stores authentication information, and the documents table stores user-created documents. The RAG system stores its data in Qdrant rather than SQLite, which is the correct architectural decision for vector storage.

An optional legal_corpus table may be added to SQLite for metadata tracking about preloaded legal documents, including columns for id, title, content, source_type, source_url, jurisdiction, effective_date, created_at, and indexed status. This table is not required for Phase 3 but may be useful for managing the legal corpus over time.

---

## 4. Implementation Steps

### Step 1: Environment Setup (Day 1)

The first step establishes the development environment with all required dependencies. The pyproject.toml file is updated to include the RAG dependencies. The core dependencies include qdrant-client for the vector database, langchain and langchain-community for the RAG framework, langchain-huggingface for HuggingFace integration, sentence-transformers for embedding models, tiktoken for token counting, pypdf for PDF processing, python-docx for Word document handling, beautifulsoup4 for HTML parsing, openai for OpenRouter integration, httpx for async HTTP, and tenacity for retry logic.

The dependencies are installed by running uv sync in the backend directory. The docker-compose.yml is updated to add the Qdrant service. A .env.development file is created for local development with QDRANT_HOST and QDRANT_PORT variables.

Verification steps include running Python import checks for qdrant_client and sentence_transformers, verifying the Qdrant container starts successfully, and confirming that the backend can connect to Qdrant.

### Step 2: Document Ingestion Pipeline (Day 2)

The second step creates the document loading and processing pipeline. The DocumentLoader base class defines an abstract interface with a load method that subclasses must implement. Concrete implementations include PDFLoader using PyPDFLoader for PDF files, MarkdownLoader for reading Markdown files from the templates directory, and TextLoader for plain text files.

The text cleaning utilities implement the clean_legal_text function that normalizes whitespace by replacing multiple consecutive newlines with double newlines and multiple consecutive spaces with single spaces, removes page numbers (standalone numbers surrounded by newlines), and strips leading and trailing whitespace.

The LegalChunker class implements the recursive text splitter with legal-specific separators. The chunk_documents method accepts a list of documents and returns a list of chunks, with each chunk containing the text content and associated metadata.

Verification steps include processing all 11 template documents successfully, verifying no information loss by comparing chunked text to the original source, and checking that chunk sizes are reasonable (200-800 tokens).

### Step 3: Embedding Generation (Day 3)

The third step generates embeddings for all document chunks. The EmbeddingService class wraps the HuggingFaceEmbeddings model with the msmarco-mpnet-base-v2 model. The embed_documents method processes multiple documents in a single call, and the embed_query method generates an embedding for a single query string.

Batch processing is implemented to handle large document sets efficiently. The embed_documents_batch function processes documents in batches of 32 to manage memory usage while maintaining throughput.

Verification steps include confirming that embedding dimensions are 768 (matching the model specification), testing that semantic similarity returns meaningful scores (relevant documents should score above 0.5), and verifying that batch processing can handle 100+ documents without memory issues.

### Step 4: Qdrant Vector Database Setup (Day 4)

The fourth step configures Qdrant and creates the storage layer. The QdrantService class manages all Qdrant interactions. The _init_collection method checks whether the collection exists and creates it with the appropriate vector configuration if needed.

The insert_points method accepts a list of dictionaries containing embeddings and payloads, converts them to PointStruct objects with UUIDs, and upserts them to Qdrant. The search method performs similarity search with optional filtering, accepts query vectors, top_k, and optional filter dictionaries, and returns results with scores and payloads.

The _build_filter method converts a simple filter dictionary to Qdrant's filter format, supporting equality matching on any payload field.

Verification steps include confirming that Qdrant accepts connections on localhost:6333, verifying that point insertion succeeds without errors, and testing that search returns relevant results with appropriate similarity scores.

### Step 5: Retrieval Service Integration (Day 5)

The fifth step creates the unified retrieval service combining all RAG components. The RetrievalService class integrates the Qdrant service and embedding service into a single interface.

The retrieve method accepts a query string, top_k, optional filters, and min_score parameters, generates a query embedding, searches Qdrant, filters results by minimum score, and returns the query, results, and total count. The ingest_document method accepts a document dictionary, determines the appropriate loader based on the source, loads the document, cleans the text, chunks into smaller pieces, generates embeddings, and stores everything in Qdrant.

The _get_loader method maps source file types to appropriate loaders based on file extension.

Verification steps include testing end-to-end retrieval with sample queries, confirming that results are sorted by relevance score, and verifying that filters work correctly for source_type and other fields.

### Step 6: Chat Service with LLM Integration (Day 6)

The sixth step integrates the LLM for response generation with RAG context. The ChatService class uses the OpenAI client configured for OpenRouter (as specified in AGENTS.md).

The generate_response method accepts a user message, retrieved context, and user ID. It builds context parts from the retrieved documents by extracting the text content and numbering each document. The system prompt instructs the LLM to act as YourHonor AI, a legal education assistant, with specific guidelines including using only information from provided documents, citing sources with [Document #] format, stating when information is insufficient, never fabricating legal citations, distinguishing facts from analysis, and including an educational disclaimer.

The user prompt includes the retrieved context and the user's question with specific instructions for response format. The LLM is called via OpenRouter with the specified model (using openrouter/gpt-oss-120b as specified for Cerebras inference via LiteLLM), a max_tokens limit of 1000, and a temperature of 0.3 for more factual responses.

The _extract_citations method creates citation objects from the retrieved documents including the title, source_type, and relevance_score.

Verification steps include confirming that responses are grounded in the provided context, verifying that citations are present and accurate, checking that the educational disclaimer is included, and testing that the low temperature produces factual responses.

### Step 7: Preload Legal Corpus (Day 7)

The seventh step ingests the initial legal documents into the RAG system. The preload_templates script iterates over all Markdown files in the templates directory, processes each one through the RetrievalService, and reports the number of chunks created.

The script creates a document object for each template with the file path as source, a formatted title, "template" as the source type, and metadata including the doc_type. It calls the ingest_document method for each template and prints progress information.

The script is executed to load all 11 legal templates into the RAG system, creating searchable chunks for each template.

### Step 8: Update Chat Endpoint (Day 8)

The eighth step modifies the /api/chat/message endpoint to use the RAG service. The updated chat.py imports the RetrievalService and ChatService, modifies the send_message endpoint to perform retrieval first, then generate a response with the LLM, and returns the response along with sources and retrieval metadata.

Error handling wraps the RAG operations in a try-except block to provide graceful degradation. If RAG fails, the endpoint returns a basic acknowledgment response with an error message rather than crashing.

Verification steps include testing the endpoint with valid authentication, confirming that RAG-enhanced responses are returned, verifying that sources are included in the response, and testing error handling by temporarily stopping Qdrant.

---

## 5. Testing Strategy

### 5.1 Unit Testing

Unit testing covers each component individually to ensure correct behavior. The document loader tests verify that PDF, Markdown, and TXT loaders correctly extract content and handle errors. The text cleaner tests verify whitespace normalization, header/footer removal, and citation preservation. The chunking tests verify legal section detection, size limit enforcement, and overlap preservation. The embedding tests verify dimension accuracy, batch processing, and query embedding generation. The Qdrant storage tests verify point insertion, search functionality, filtering, and deletion. The retrieval tests verify end-to-end retrieval with various query types. The chat service tests verify response generation, citation extraction, and prompt construction.

### 5.2 Integration Testing

Integration testing verifies that components work together correctly. The document ingestion flow tests loading a template, chunking into pieces, generating embeddings, storing in Qdrant, and searching successfully. The RAG query flow tests submitting a user query, generating a query embedding, searching Qdrant, passing results to the LLM, and returning a response with citations. The error recovery tests verify graceful handling when Qdrant is unavailable (fallback response), when the LLM times out (partial response), and when retrieval returns no results ("no results" message).

### 5.3 Performance Testing

Performance testing measures system responsiveness under various loads. The key metrics include retrieval latency (target under 500ms), embedding latency (target under 2 seconds per document), chat response time (target under 5 seconds total), and vector database query time (target under 100ms). Load testing verifies concurrent request handling by executing multiple simultaneous queries and measuring throughput and latency distribution.

### 5.4 Hallucination Testing

Hallucination testing is critical for legal AI applications. The out-of-scope query test verifies that when a user asks about a topic not in the corpus, the system responds with "I don't have information about..." rather than fabricating an answer. The partial information test verifies that when a query is only partially answered by available documents, the system answers what's available while noting what information is missing. The citation verification test verifies that generated citations match actual retrieved documents.

---

## 6. Dependencies

### 6.1 Python Package Dependencies

The core RAG packages include qdrant-client version 1.7.0 or higher for the vector database client, langchain version 0.2.0 or higher for the RAG framework, langchain-community version 0.2.0 or higher for LangChain integrations, langchain-huggingface version 0.1.0 or higher for HuggingFace integration, sentence-transformers version 3.0.0 or higher for embedding models, and tiktoken version 0.7.0 or higher for token counting.

The document processing packages include pypdf version 5.1.0 or higher for PDF text extraction, python-docx version 1.1.0 or higher for DOCX handling, and beautifulsoup4 version 4.12.0 or higher for HTML parsing.

The LLM integration packages include openai version 1.12.0 or higher for the OpenAI/OpenRouter client and httpx version 0.27.0 or higher for async HTTP.

The utility packages include tenacity version 8.2.0 or higher for retry logic and python-dotenv version 1.0.0 or higher for environment variable handling.

### 6.2 System Dependencies

PDF processing requires system packages including poppler-utils for PDF utilities, tesseract-ocr for OCR on scanned documents, and libpoppler-cpp-dev for Poppler development files. These are installed via apt-get in the Dockerfile.

### 6.3 Docker Changes

The docker-compose.yml adds the Qdrant service with the official image, exposed ports, volume mapping, and network configuration. The backend service is updated to depend on Qdrant, include QDRANT_HOST and QDRANT_PORT environment variables, and connect to the shared network.

The Dockerfile.backend adds the system dependencies before Python environment setup, and the RAG packages are included in the pyproject.toml before uv sync is executed.

---

## 7. Challenges and Security

### 7.1 Hallucination Prevention

Hallucination prevention is the most critical challenge for legal AI applications. The system must never fabricate citations, case law, or legal rules, as fabrications could mislead students and cause fundamental learning errors.

The primary defense is source grounding, which requires all responses to cite retrieved documents, includes retrieved text directly in the prompt context, and uses a low temperature (0.3) for factual responses. Prompt engineering embeds strict instructions in the system prompt including the requirement to use only information from provided documents, to state when information is insufficient, and to never fabricate citations or legal rules.

The retrieval threshold sets a minimum score of 0.5 to ensure relevance, and if no results exceed the threshold, the system returns a "no information available" response rather than guessing. Citation verification extracts citations from retrieved documents and includes source titles in responses rather than relying on case numbers that might be fabricated.

The output structure uses structured output to separate facts from analysis, includes an explicit sources section in responses, and adds an educational disclaimer stating that the system is for educational purposes only and not legal advice.

### 7.2 Citation Accuracy

Citation accuracy is essential for legal education. The model may generate incorrect citation formats or reference wrong cases, which could confuse students or lead to research errors.

Mitigations include pre-extracting citations from source documents and storing them in document metadata, validating generated citations against stored metadata before returning them, using source titles rather than case numbers in responses, and implementing human review for critical educational content.

### 7.3 Data Privacy and Security

User-uploaded documents may contain sensitive information that must be protected. Chat history may contain legal queries with confidential details. The vector database may retain embedded versions of documents that could be extracted.

Mitigations include user document isolation (user documents stored separately from the public corpus), data retention policies (document expiration options and user deletion capabilities), secure API design (authentication for all RAG endpoints and file upload validation), and Docker security (Qdrant in isolated container, internal network between services, no external Qdrant port exposure).

### 7.4 Additional Risks

Additional risks and mitigations include Qdrant unavailability (graceful degradation with fallback responses), slow embedding generation (batch processing, caching, async operations), large document handling (chunk size limits and streaming processing), invalid document formats (file type validation and error handling), outdated legal information (date metadata and periodic corpus updates), and prompt injection (input sanitization and prompt guardrails).

---

## 8. Architecture Diagram

The architecture diagram illustrates the complete RAG pipeline integrated with the existing YourHonor AI platform. The frontend (Next.js) communicates with the backend (FastAPI), which coordinates with Qdrant for vector storage and SQLite for user data. The RAG pipeline includes document ingestion, chunking, embedding generation, and storage in Qdrant. The chat service retrieves documents from Qdrant, builds prompts with context, calls the LLM via OpenRouter, and returns responses with citations. Data flows from user messages through retrieval, embedding, search, context assembly, LLM generation, and back to the user.

---

## 9. File Changes Summary

### New Files to Create

The new service files include backend/app/services/retrieval.py for the retrieval service combining Qdrant and embeddings, backend/app/services/chat.py for the LLM integration with RAG, backend/app/services/ingestion.py for document loading from various sources, backend/app/services/embeddings.py for embedding generation, backend/app/services/qdrant_store.py for the Qdrant client wrapper, backend/app/services/chunking.py for the legal document chunker, and backend/app/services/text_cleaning.py for text cleaning utilities.

The new API files include backend/app/api/rag.py for RAG management endpoints.

The new test files include tests/test_ingestion.py for ingestion unit tests, tests/test_retrieval.py for retrieval unit tests, tests/test_chat.py for chat integration tests, and tests/test_hallucination.py for hallucination prevention tests.

The new script files include scripts/preload_legal_corpus.py for preloading legal documents and scripts/test_rag.py for manual testing.

The new documentation file is docs/rag-implementation-plan.md.

### Files to Modify

The files to modify include backend/app/api/chat.py for RAG integration, backend/pyproject.toml for RAG dependencies, docker/docker-compose.yml for Qdrant service, and docker/Dockerfile.backend for system dependencies.

### Files to Delete

No files need to be deleted for Phase 3 implementation.

---

This comprehensive implementation plan provides the complete roadmap for Phase 3 RAG integration. The plan specifies exact libraries and versions, detailed architectural decisions with tradeoffs, expected file changes, and API modifications. Following this plan will result in a fully functional legal RAG system that provides students with accurate, cited responses to legal questions while maintaining the highest standards for hallucination prevention and citation accuracy essential for legal education applications.
