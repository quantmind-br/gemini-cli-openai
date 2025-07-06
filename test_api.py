#!/usr/bin/env python3
"""
Script para testar a API Gemini CLI OpenAI
Testa vários endpoints e funcionalidades usando o modelo gemini-2.5-pro
"""

import requests
import json
import time
import os
from typing import Dict, Any, Optional

class GeminiAPITester:
    def __init__(self, base_url: str = "http://localhost:3000", api_key: str = "sk-your-secret-api-key-here"):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
    
    def print_section(self, title: str):
        """Imprime uma seção separada"""
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
    
    def print_result(self, test_name: str, success: bool, details: str = ""):
        """Imprime resultado de um teste"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"     {details}")
    
    def test_health_endpoint(self) -> bool:
        """Testa o endpoint de health"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.print_result("Health Check", True, f"Status: {data.get('status')}")
                return True
            else:
                self.print_result("Health Check", False, f"Status Code: {response.status_code}")
                return False
        except Exception as e:
            self.print_result("Health Check", False, f"Error: {str(e)}")
            return False
    
    def test_root_endpoint(self) -> bool:
        """Testa o endpoint raiz"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.print_result("Root Endpoint", True, f"Name: {data.get('name')}")
                return True
            else:
                self.print_result("Root Endpoint", False, f"Status Code: {response.status_code}")
                return False
        except Exception as e:
            self.print_result("Root Endpoint", False, f"Error: {str(e)}")
            return False
    
    def test_models_endpoint(self) -> bool:
        """Testa o endpoint de modelos"""
        try:
            response = requests.get(f"{self.base_url}/v1/models", headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                models = [model['id'] for model in data.get('data', [])]
                has_gemini_pro = 'gemini-2.5-pro' in models
                self.print_result("Models List", True, f"Found {len(models)} models")
                self.print_result("Gemini 2.5 Pro Available", has_gemini_pro, f"Models: {', '.join(models[:3])}...")
                return has_gemini_pro
            else:
                self.print_result("Models List", False, f"Status Code: {response.status_code}")
                return False
        except Exception as e:
            self.print_result("Models List", False, f"Error: {str(e)}")
            return False
    
    def test_simple_completion(self) -> bool:
        """Testa uma completion simples sem streaming"""
        try:
            payload = {
                "model": "gemini-2.5-pro",
                "messages": [
                    {"role": "user", "content": "Olá! Como você está? Responda em português."}
                ],
                "stream": False,
                "max_tokens": 100
            }
            
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                self.print_result("Simple Completion", True, f"Response: {content[:50]}...")
                return True
            else:
                error_data = response.text
                self.print_result("Simple Completion", False, f"Status: {response.status_code}, Error: {error_data[:100]}")
                return False
        except Exception as e:
            self.print_result("Simple Completion", False, f"Error: {str(e)}")
            return False
    
    def test_streaming_completion(self) -> bool:
        """Testa uma completion com streaming"""
        try:
            payload = {
                "model": "gemini-2.5-pro",
                "messages": [
                    {"role": "user", "content": "Conte uma história curta sobre um robô em português."}
                ],
                "stream": True,
                "max_tokens": 200
            }
            
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30,
                stream=True
            )
            
            if response.status_code == 200:
                chunks_received = 0
                content_parts = []
                
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data: '):
                            data_str = line[6:]  # Remove 'data: '
                            if data_str.strip() == '[DONE]':
                                break
                            try:
                                data = json.loads(data_str)
                                chunk_content = data.get('choices', [{}])[0].get('delta', {}).get('content', '')
                                if chunk_content:
                                    content_parts.append(chunk_content)
                                    chunks_received += 1
                            except json.JSONDecodeError:
                                continue
                
                full_content = ''.join(content_parts)
                self.print_result("Streaming Completion", True, f"Received {chunks_received} chunks")
                print(f"     Content preview: {full_content[:100]}...")
                return chunks_received > 0
            else:
                error_data = response.text
                self.print_result("Streaming Completion", False, f"Status: {response.status_code}, Error: {error_data[:100]}")
                return False
        except Exception as e:
            self.print_result("Streaming Completion", False, f"Error: {str(e)}")
            return False
    
    def test_thinking_mode(self) -> bool:
        """Testa o modo thinking (se habilitado)"""
        try:
            payload = {
                "model": "gemini-2.5-pro",
                "messages": [
                    {"role": "user", "content": "Resolva este problema passo a passo: Quanto é 15% de 240?"}
                ],
                "stream": False,
                "include_reasoning": True,
                "thinking_budget": 1024
            }
            
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                self.print_result("Thinking Mode", True, f"Response: {content[:50]}...")
                return True
            else:
                error_data = response.text
                self.print_result("Thinking Mode", False, f"Status: {response.status_code}, Error: {error_data[:100]}")
                return False
        except Exception as e:
            self.print_result("Thinking Mode", False, f"Error: {str(e)}")
            return False
    
    def test_debug_endpoints(self) -> bool:
        """Testa os endpoints de debug"""
        try:
            # Test cache endpoint
            cache_response = requests.get(f"{self.base_url}/v1/debug/cache", headers=self.headers, timeout=10)
            cache_success = cache_response.status_code == 200
            
            # Test token test endpoint
            token_response = requests.post(f"{self.base_url}/v1/token-test", headers=self.headers, timeout=15)
            token_success = token_response.status_code == 200
            
            self.print_result("Debug - Cache Status", cache_success)
            self.print_result("Debug - Token Test", token_success)
            
            return cache_success and token_success
        except Exception as e:
            self.print_result("Debug Endpoints", False, f"Error: {str(e)}")
            return False
    
    def test_conversation(self) -> bool:
        """Testa uma conversa com múltiplas mensagens"""
        try:
            payload = {
                "model": "gemini-2.5-pro",
                "messages": [
                    {"role": "system", "content": "Você é um assistente útil que fala português."},
                    {"role": "user", "content": "Qual é a capital do Brasil?"},
                    {"role": "assistant", "content": "A capital do Brasil é Brasília."},
                    {"role": "user", "content": "E qual é a população dessa cidade?"}
                ],
                "stream": False,
                "max_tokens": 150
            }
            
            response = requests.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                self.print_result("Multi-turn Conversation", True, f"Response: {content[:50]}...")
                return True
            else:
                error_data = response.text
                self.print_result("Multi-turn Conversation", False, f"Status: {response.status_code}, Error: {error_data[:100]}")
                return False
        except Exception as e:
            self.print_result("Multi-turn Conversation", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Executa todos os testes"""
        print("🚀 Iniciando testes da API Gemini CLI OpenAI")
        print(f"Base URL: {self.base_url}")
        print(f"API Key: {self.api_key}")
        
        results = []
        
        # Testes básicos
        self.print_section("Testes Básicos")
        results.append(("Health Check", self.test_health_endpoint()))
        results.append(("Root Endpoint", self.test_root_endpoint()))
        results.append(("Models List", self.test_models_endpoint()))
        
        # Testes de completion
        self.print_section("Testes de Completion")
        results.append(("Simple Completion", self.test_simple_completion()))
        results.append(("Streaming Completion", self.test_streaming_completion()))
        results.append(("Thinking Mode", self.test_thinking_mode()))
        results.append(("Multi-turn Conversation", self.test_conversation()))
        
        # Testes de debug
        self.print_section("Testes de Debug")
        results.append(("Debug Endpoints", self.test_debug_endpoints()))
        
        # Resumo final
        self.print_section("Resumo dos Testes")
        passed = sum(1 for _, success in results if success)
        total = len(results)
        
        for test_name, success in results:
            status = "✅" if success else "❌"
            print(f"{status} {test_name}")
        
        print(f"\n📊 Resultado: {passed}/{total} testes passaram")
        
        if passed == total:
            print("🎉 Todos os testes passaram! A API está funcionando corretamente.")
        else:
            print("⚠️  Alguns testes falharam. Verifique os logs acima para mais detalhes.")
        
        return passed == total

def main():
    """Função principal"""
    # Você pode modificar estas configurações conforme necessário
    base_url = "http://localhost:3000"
    api_key = "sk-your-secret-api-key-here"  # Use a mesma chave do .env
    
    tester = GeminiAPITester(base_url, api_key)
    
    try:
        success = tester.run_all_tests()
        exit_code = 0 if success else 1
        exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Testes interrompidos pelo usuário")
        exit(1)
    except Exception as e:
        print(f"\n\n❌ Erro inesperado: {e}")
        exit(1)

if __name__ == "__main__":
    main()