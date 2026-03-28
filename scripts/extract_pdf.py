import sys
import json
import contextlib

# stdout を UTF-8 に強制（Windows の cp932 エンコードエラー対策）
sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
import onnxruntime as ort

# pymupdf_layout の ONNX 呼び出しで int32/int64 不一致が起きるためパッチ
_orig_run = ort.InferenceSession.run
def _patched_run(self, output_names, input_feed, run_options=None):
    fixed = {
        k: v.astype(np.int64) if isinstance(v, np.ndarray) and v.dtype == np.int32 else v
        for k, v in input_feed.items()
    }
    return _orig_run(self, output_names, fixed, run_options)
ort.InferenceSession.run = _patched_run

import pymupdf4llm

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No PDF path provided"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    try:
        chunks = pymupdf4llm.to_markdown(pdf_path, page_chunks=True)
        result = []
        for chunk in chunks:
            page_num = chunk.get("metadata", {}).get("page_number", 1)  # 1-indexed
            text = chunk.get("text", "")
            if text.strip():
                result.append({"page": page_num, "text": text})
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
