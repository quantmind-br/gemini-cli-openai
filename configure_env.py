import json
import os
import shutil

def main():
    """Interactively configures the .env file with GCP credentials."""
    print("--- Gemini CLI OpenAI Environment Configurator ---")

    # Get the path to the credentials file
    default_creds_path = os.path.expanduser("~/.gemini/oauth_creds.json")
    creds_path = input(
        f"Enter the path to your oauth_creds.json file [default: {default_creds_path}]: "
    ).strip()

    if not creds_path:
        creds_path = default_creds_path

    # Check if the credentials file exists
    if not os.path.isfile(creds_path):
        print(f"\nERROR: Credentials file not found at '{creds_path}'")
        print("Please run 'gemini auth' or provide the correct path.")
        return

    # Read and process the credentials
    try:
        with open(creds_path, 'r', encoding='utf-8') as f:
            creds_json = json.load(f)
        
        # Convert to a compact, single-line JSON string
        gcp_service_account_str = json.dumps(creds_json, separators=(',', ':'))
    except (json.JSONDecodeError, IOError) as e:
        print(f"\nERROR: Failed to read or parse the credentials file: {e}")
        return

    print("\nSuccessfully read and processed credentials.")

    # Define .env and .env.example paths
    env_path = '.env'
    env_example_path = '.env.example'

    # Create .env from .env.example if it doesn't exist
    if not os.path.exists(env_path):
        if not os.path.exists(env_example_path):
            print(f"\nERROR: '{env_example_path}' not found. Cannot create '.env' file.")
            return
        shutil.copy(env_example_path, env_path)
        print(f"Created '{env_path}' from '{env_example_path}'.")

    # Read the .env file
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            env_content = f.readlines()
    except IOError as e:
        print(f"\nERROR: Could not read '{env_path}': {e}")
        return

    # Update the GCP_SERVICE_ACCOUNT line
    updated_env_content = []
    found_key = False
    for line in env_content:
        if line.strip().startswith('GCP_SERVICE_ACCOUNT='):
            updated_env_content.append(f"GCP_SERVICE_ACCOUNT='{gcp_service_account_str}'\n")
            found_key = True
        else:
            updated_env_content.append(line)
    
    if not found_key:
        updated_env_content.append(f"\nGCP_SERVICE_ACCOUNT='{gcp_service_account_str}'\n")

    # Write the updated content back to the .env file
    try:
        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(updated_env_content)
    except IOError as e:
        print(f"\nERROR: Could not write to '{env_path}': {e}")
        return

    print(f"\nSuccessfully configured '{env_path}' with your credentials.")
    print("You can now start the application using 'docker-compose up -d'.")

if __name__ == "__main__":
    main()