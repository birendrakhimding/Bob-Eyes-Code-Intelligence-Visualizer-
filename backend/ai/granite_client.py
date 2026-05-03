import os


def get_granite_descriptions(nodes: list[dict]) -> dict:
    try:
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai.metanames import GenTextParamsMetaNames

        api_key = os.environ.get("WATSONX_API_KEY")
        project_id = os.environ.get("WATSONX_PROJECT_ID")
        url = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

        if not api_key or not project_id:
            print("Warning: WATSONX_API_KEY or WATSONX_PROJECT_ID not found in .env")
            return {}

        model = ModelInference(
            model_id="ibm/granite-8b-code-instruct",
            credentials={"apikey": api_key, "url": url},
            project_id=project_id,
            params={
                GenTextParamsMetaNames.MAX_NEW_TOKENS: 60,
                GenTextParamsMetaNames.TEMPERATURE: 0.1,
            },
        )

        descriptions = {}
        for node in nodes:
            if node["type"] != "function":
                continue
            prompt = (
                f"Describe this function in exactly one short sentence (max 15 words).\n"
                f"Function: {node['name']}({', '.join(node['params'])})\n"
                f"Body: {'; '.join(node['body_summary'][:3])}\n"
                f"Description:"
            )
            result = model.generate_text(prompt)
            print(f"AI: {node['name']} -> {result.strip()}")
            descriptions[node["id"]] = result.strip()
        return descriptions

    except Exception as e:
        print(f"Granite AI skipped: {e}")
        return {}

# Made with Bob
