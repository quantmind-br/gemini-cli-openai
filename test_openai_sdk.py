#!/usr/bin/env python3
"""
Script para testar a API usando o SDK oficial do OpenAI
Demonstra a compatibilidade total com a biblioteca openai
"""

try:
    from openai import OpenAI
except ImportError:
    print("❌ Biblioteca 'openai' não encontrada.")
    print("📦 Instale com: pip install openai")
    exit(1)

import json
import time
from typing import List, Dict, Any

class OpenAISDKTester:
    def __init__(self, base_url: str = "http://localhost:3000/v1", api_key: str = "sk-your-secret-api-key-here"):
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key
        )
        self.base_url = base_url
        self.api_key = api_key
    
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
    
    def test_list_models(self) -> bool:
        """Testa listagem de modelos"""
        try:
            models = self.client.models.list()
            model_ids = [model.id for model in models.data]
            has_gemini_pro = 'gemini-2.5-pro' in model_ids
            
            self.print_result("SDK - List Models", True, f"Found {len(model_ids)} models")
            self.print_result("SDK - Gemini 2.5 Pro Available", has_gemini_pro, f"Models: {', '.join(model_ids[:3])}...")
            return has_gemini_pro
        except Exception as e:
            self.print_result("SDK - List Models", False, f"Error: {str(e)}")
            return False
    
    def test_simple_completion(self) -> bool:
        """Testa completion simples com SDK"""
        try:
            response = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[
                    {"role": "user", "content": "Diga 'Olá!' em português e explique brevemente o que você é."}
                ],
                max_tokens=100,
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            self.print_result("SDK - Simple Completion", True, f"Response: {content[:50]}...")
            print(f"     Full response: {content}")
            return True
        except Exception as e:
            self.print_result("SDK - Simple Completion", False, f"Error: {str(e)}")
            return False
    
    def test_streaming_completion(self) -> bool:
        """Testa completion com streaming usando SDK"""
        try:
            stream = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[
                    {"role": "user", "content": "Conte uma piada sobre programadores em português."}
                ],
                stream=True,
                max_tokens=200
            )
            
            chunks_received = 0
            content_parts = []
            
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content_parts.append(chunk.choices[0].delta.content)
                    chunks_received += 1
            
            full_content = ''.join(content_parts)
            self.print_result("SDK - Streaming Completion", True, f"Received {chunks_received} chunks")
            print(f"     Content: {full_content}")
            return chunks_received > 0
        except Exception as e:
            self.print_result("SDK - Streaming Completion", False, f"Error: {str(e)}")
            return False
    
    def test_system_message(self) -> bool:
        """Testa completion com system message"""
        try:
            response = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[
                    {"role": "system", "content": "Você é um assistente especialista em matemática que sempre explica os cálculos passo a passo."},
                    {"role": "user", "content": "Quanto é 25% de 80?"}
                ],
                max_tokens=150
            )
            
            content = response.choices[0].message.content
            self.print_result("SDK - System Message", True, f"Response: {content[:50]}...")
            print(f"     Full response: {content}")
            return True
        except Exception as e:
            self.print_result("SDK - System Message", False, f"Error: {str(e)}")
            return False
    
    def test_conversation_history(self) -> bool:
        """Testa conversa com histórico"""
        try:
            response = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[
                    {"role": "user", "content": "Qual é a capital da França?"},
                    {"role": "assistant", "content": "A capital da França é Paris."},
                    {"role": "user", "content": "Qual é o principal ponto turístico dessa cidade?"}
                ],
                max_tokens=100
            )
            
            content = response.choices[0].message.content
            self.print_result("SDK - Conversation History", True, f"Response: {content[:50]}...")
            print(f"     Full response: {content}")
            return True
        except Exception as e:
            self.print_result("SDK - Conversation History", False, f"Error: {str(e)}")
            return False
    
    def test_thinking_mode(self) -> bool:
        """Testa modo thinking (se habilitado no servidor)"""
        try:
            response = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[
                    {"role": "user", "content": "Resolva este problema matemático passo a passo: Se um trem viaja a 80 km/h e percorre 240 km, quanto tempo leva a viagem?"}
                ],
                max_tokens=200,
                extra_body={
                    "include_reasoning": True,
                    "thinking_budget": 1024
                }
            )
            
            content = response.choices[0].message.content
            self.print_result("SDK - Thinking Mode", True, f"Response: {content[:50]}...")
            print(f"     Full response: {content}")
            return True
        except Exception as e:
            self.print_result("SDK - Thinking Mode", False, f"Error: {str(e)}")
            return False
    
    def test_different_temperatures(self) -> bool:
        """Testa diferentes temperaturas"""
        try:
            prompt = "Complete esta frase de forma criativa: 'O gato subiu no telhado e...'"
            
            # Baixa temperatura (mais determinística)
            response_low = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=50
            )
            
            # Alta temperatura (mais criativa)
            response_high = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.9,
                max_tokens=50
            )
            
            content_low = response_low.choices[0].message.content
            content_high = response_high.choices[0].message.content
            
            self.print_result("SDK - Temperature Control", True, "Tested low and high temperatures")
            print(f"     Low temp (0.1): {content_low}")
            print(f"     High temp (0.9): {content_high}")
            return True
        except Exception as e:
            self.print_result("SDK - Temperature Control", False, f"Error: {str(e)}")
            return False
    
    def test_token_usage_info(self) -> bool:
        """Testa informações de uso de tokens"""
        try:
            response = self.client.chat.completions.create(
                model="gemini-2.5-pro",
                messages=[
                    {"role": "user", "content": "Escreva um parágrafo sobre inteligência artificial."}
                ],
                max_tokens=100
            )
            
            usage = response.usage
            if usage:
                self.print_result("SDK - Token Usage Info", True, "Usage info available")
                print(f"     Prompt tokens: {usage.prompt_tokens}")
                print(f"     Completion tokens: {usage.completion_tokens}")
                print(f"     Total tokens: {usage.total_tokens}")
                return True
            else:
                self.print_result("SDK - Token Usage Info", False, "No usage info returned")
                return False
        except Exception as e:
            self.print_result("SDK - Token Usage Info", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Executa todos os testes"""
        print("🚀 Iniciando testes com OpenAI SDK")
        print(f"Base URL: {self.base_url}")
        print(f"API Key: {self.api_key}")
        
        results = []
        
        # Testes básicos do SDK
        self.print_section("Testes Básicos do SDK")
        results.append(("List Models", self.test_list_models()))
        results.append(("Simple Completion", self.test_simple_completion()))
        results.append(("Streaming Completion", self.test_streaming_completion()))
        
        # Testes avançados
        self.print_section("Testes Avançados")
        results.append(("System Message", self.test_system_message()))
        results.append(("Conversation History", self.test_conversation_history()))
        results.append(("Thinking Mode", self.test_thinking_mode()))
        results.append(("Temperature Control", self.test_different_temperatures()))
        results.append(("Token Usage Info", self.test_token_usage_info()))
        
        # Resumo final
        self.print_section("Resumo dos Testes SDK")
        passed = sum(1 for _, success in results if success)
        total = len(results)
        
        for test_name, success in results:
            status = "✅" if success else "❌"
            print(f"{status} {test_name}")
        
        print(f"\n📊 Resultado: {passed}/{total} testes passaram")
        
        if passed == total:
            print("🎉 Todos os testes do SDK passaram! A compatibilidade OpenAI está perfeita.")
        else:
            print("⚠️  Alguns testes falharam. Verifique os logs acima para mais detalhes.")
        
        return passed == total

def main():
    """Função principal"""
    base_url = "http://localhost:3000/v1"
    api_key = "sk-your-secret-api-key-here"  # Use a mesma chave do .env
    
    tester = OpenAISDKTester(base_url, api_key)
    
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