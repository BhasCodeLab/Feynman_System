from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util
from transformers import pipeline
import re

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from backend

# MODEL LOADING 
# Load models once at startup
embedder = SentenceTransformer('all-MiniLM-L6-v2')

# Using DeBERTa-v3-small 
nli = pipeline(
    "text-classification", 
    model="cross-encoder/nli-deberta-v3-small"
)

print("[OK] Models loaded successfully:")
print("   - Embedder: all-MiniLM-L6-v2")
print("   - NLI Model: cross-encoder/nli-deberta-v3-small")

@app.route('/verify', methods=['POST'])
def verify():
    data = request.json
    original = data.get("original", "")
    claims = data.get("claims", [])

    if not original or not claims:
        return jsonify({"error": "Missing original text or claims"}), 400

    # Split original text into sentences
    sentences = re.split(r'(?<=[.!?])\s+', original.strip())
    if not sentences or sentences == ['']:
        sentences = [original]

    # Encode all sentences once
    sent_embeddings = embedder.encode(sentences)

    results = []
    supported_count = 0

    for claim in claims:
        if not claim or not claim.strip():
            continue

        # Get claim embedding
        claim_emb = embedder.encode(claim)

        # Get Top-2 most similar sentences
        scores = util.cos_sim(claim_emb, sent_embeddings)[0]
        top_k = min(2, len(sentences))
        top_indices = scores.topk(top_k).indices.tolist()
        top_indices.sort()   # Keep original order for better flow

        # Combine top-2 sentences
        evidence_sentences = [sentences[i].strip() for i in top_indices]
        premise = " ".join(evidence_sentences)

        # Run NLI with DeBERTa
        nli_output = nli({"text": premise, "text_pair": claim})

        # Safe result extraction
        result = nli_output[0] if isinstance(nli_output, list) else nli_output

        # Safe label handling (works with both LABEL_X and direct labels)
        label_str = result["label"].upper()

        if "ENTAILMENT" in label_str:
            status = "SUPPORTED"
            supported_count += 1
        elif "CONTRADICTION" in label_str:
            status = "CONTRADICTED"
        else:
            status = "NOT_SUPPORTED"

        results.append({
            "claim": claim,
            "status": status,
            "evidence": premise,
            "confidence": round(result.get("score", 0), 3)
        })

    support_score = round((supported_count / len(claims)) * 100, 2) if claims else 0

    return jsonify({
        "results": results,
        "support_score": support_score
    })

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)