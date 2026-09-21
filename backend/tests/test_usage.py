import asyncio, tempfile, os, unittest
from pathlib import Path
from unittest.mock import patch
from dotenv import load_dotenv
load_dotenv()
from backend.admin.store import LiveDataStore
from backend.admin import fish_audio
from backend.admin.routes import AgentCreditTopUpPayload, CallLogPayload
from pydantic import ValidationError
class UsageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.env=patch.dict(os.environ, {'SCADOVA_ADMIN_STATE':str(Path(self.temp.name)/'state.json')});self.env.start()
        self.store=LiveDataStore();self.store.list_businesses=lambda:[]
        self.store.add_agent({'id':100,'agent_id':'local-a','fish_agent_id':'local-a','name':'Test','business_id':1,'business_name':'Test business'})
    def tearDown(self): self.env.stop();self.temp.cleanup()
    def test_minute_rounding_and_historical_rate(self):
        self.store.set_agent_credit_limit('local-a',100,2)
        self.store.add_agent_credits('local-a',10)
        call=self.store.add_call({'agent_id':'local-a','duration_seconds':61})
        self.assertEqual(call['credits_used'],4)
        self.store.set_agent_credit_limit('local-a',100,3)
        self.assertEqual(self.store.get_agent_usage_summary()['totals']['remaining_balance'],6)
        restored=LiveDataStore();restored.list_businesses=lambda:[]
        self.assertEqual(restored.get_agent_usage_summary()['totals']['remaining_balance'],6)
    def test_no_fake_calls_or_initial_credit(self):
        self.assertEqual(self.store.list_calls(),[])
        self.assertEqual(self.store.get_agent_usage_summary()['totals']['remaining_balance'],0)
    def test_limit_rejects_without_ledger_mutation(self):
        self.store.set_agent_credit_limit('local-a',10)
        with self.assertRaises(ValueError): self.store.add_agent_credits('local-a',11)
        self.assertEqual(self.store.agent_credit_ledger,[])
    def test_zero_rate_stays_zero(self):
        self.store.set_agent_credit_limit('local-a',100,0)
        self.store.add_call({'agent_id':'local-a','duration_seconds':60})
        self.store.set_agent_credit_limit('local-a',100,5)
        self.assertEqual(self.store.get_agent_usage_summary()['totals']['credits_used'],0)
    def test_invalid_values(self):
        for v in [-1,0,float('nan'),float('inf')]:
            with self.assertRaises(ValidationError): AgentCreditTopUpPayload(amount=v)
    def test_provider_pagination_dedup_and_minutes(self):
        settings=self.store.get_agent_credit_settings('local-a');settings['fish_provider_agent_id']='fish-a';self.store.agent_credit_settings['local-a']=settings
        async def request(path,params):
            second='cursor' in params
            return {'sessions':[{'session_id':'s2' if second else 's1','agent_id':'fish-a','duration_seconds':61,'status':'completed'}], 'has_more':not second,'next_cursor':None if second else 'next'}
        with patch.object(fish_audio,'data_store',self.store),patch.object(fish_audio,'fish_request',request):
            self.assertEqual(asyncio.run(fish_audio.sync_fish('local-a'))['imported'],2)
            self.assertEqual(asyncio.run(fish_audio.sync_fish('local-a'))['imported'],0)
            asyncio.run(fish_audio.top_up_minutes('local-a',fish_audio.MinuteTopUp(minutes=10)))
        self.assertEqual(len(self.store.local_calls),2)
        self.assertEqual(self.store.get_agent_credit_settings('local-a')['credits_added'],10)
    def test_knowledge_record_defaults_and_save(self):
        record=self.store.get_provider_knowledge('local-a')
        self.assertEqual(record['agent_id'],'local-a')
        self.assertIsNone(record['provider_source_id'])
        record['offers']=[{'title':'Diwali 20% off','details':'Dine-in only','valid_until':'2026-10-31'}]
        self.store.set_provider_knowledge('local-a',record)
        restored=LiveDataStore();restored.list_businesses=lambda:[]
        self.assertEqual(restored.get_provider_knowledge('local-a')['offers'][0]['title'],'Diwali 20% off')
    def test_knowledge_markdown_renders_profile_services_offers_docs(self):
        record={'business_name':'Test business','profile':{'description':'Family restaurant','hours':'Mon-Sun 11am-11pm','policies':'No split bills'},'services':[{'name':'Butter Chicken','description':'House special','price':'$14.99','availability':'Daily'}],'offers':[{'title':'Week 20% off','details':'On all curries','valid_until':'Oct 31'}],'documents':[{'name':'Allergen chart','content':'Nut cross-contamination warning.'}],'extra_markdown':'Bonus section'}
        md=fish_audio.build_knowledge_markdown(record,{'business_name':'Test business'})
        for fragment in ['# Test business','Family restaurant','## Business hours','## Service: Butter Chicken','Price: $14.99','## Current offers','Week 20% off','## Document: Allergen chart','Bonus section']:
            self.assertIn(fragment,md)
    def test_push_creates_attaches_and_persists_source_id(self):
        settings=self.store.get_agent_credit_settings('local-a');settings['fish_provider_agent_id']='fish-a';self.store.agent_credit_settings['local-a']=settings
        calls=[]
        async def fake_api(method,path,params=None,json_body=None,files=None,data=None):
            calls.append((method,path,json_body))
            if method=='POST' and path=='/v1/agent/knowledge-sources': return {'knowledge_source_id':'src-1'}
            if method=='POST' and path.endswith('/publish'): return {'version_number':7}
            return {}
        payload=fish_audio.KnowledgePush(publish=True,offers=[{'title':'Week 1 offer'}],profile={'description':'Test biz'})
        with patch.object(fish_audio,'data_store',self.store),patch.object(fish_audio,'fish_api',fake_api):
            result=asyncio.run(fish_audio.push_agent_knowledge('local-a',payload))
        self.assertEqual(self.store.get_provider_knowledge('local-a')['offers'][0]['title'],'Week 1 offer')
        self.assertTrue(result['success'])
        self.assertEqual(result['provider_source_id'],'src-1')
        self.assertEqual(result['published_version'],7)
        self.assertEqual(self.store.get_provider_knowledge('local-a')['provider_source_id'],'src-1')
        self.assertEqual(self.store.get_provider_knowledge('local-a')['last_published_version'],7)
        config_calls=[c for c in calls if c[1].endswith('/config')]
        self.assertEqual(config_calls[0][2],{'knowledge_base':{'enabled':True,'knowledge_source_ids':['src-1']}})
        self.assertEqual(calls[-1][1].endswith('/publish'),True)
    def test_push_rejects_empty_knowledge(self):
        settings=self.store.get_agent_credit_settings('local-a');settings['fish_provider_agent_id']='fish-a';self.store.agent_credit_settings['local-a']=settings
        with patch.object(fish_audio,'data_store',self.store):
            with self.assertRaises(fish_audio.HTTPException):
                asyncio.run(fish_audio.push_agent_knowledge('local-a',fish_audio.KnowledgePush()))
    def test_push_recreates_missing_provider_source(self):
        settings=self.store.get_agent_credit_settings('local-a');settings['fish_provider_agent_id']='fish-a';self.store.agent_credit_settings['local-a']=settings
        async def fake_api(method,path,params=None,json_body=None,files=None,data=None):
            if method=='PATCH' and 'knowledge-sources' in path: raise fish_audio.HTTPException(404,'missing')
            if method=='POST' and path=='/v1/agent/knowledge-sources': return {'knowledge_source_id':'src-2'}
            return {}
        with patch.object(fish_audio,'data_store',self.store),patch.object(fish_audio,'fish_api',fake_api):
            result=asyncio.run(fish_audio.push_agent_knowledge('local-a',fish_audio.KnowledgePush(extra_markdown='hello')))
        self.assertEqual(result['provider_source_id'],'src-2')
        self.assertEqual(result['published_version'],None)
        self.assertEqual(self.store.get_provider_knowledge('local-a')['provider_source_id'],'src-2')
if __name__=='__main__':unittest.main()
