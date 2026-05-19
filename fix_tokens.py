with open('/Users/' + __import__('os').getlogin() + '/Desktop/sd-os/pages/index.jsx', 'r') as f:
    c = f.read()

c = c.replace('async function callAI(prompt, useSearch = false) {', 'async function callAI(prompt, useSearch = false, maxTokens = 2000) {')
c = c.replace('max_tokens: 1000,', 'max_tokens: maxTokens,')
c = c.replace("callAI(`B2B researcher", "callAI(`B2B researcher".replace('`B2B', '`B2B').replace("`, true);", "`, true, 2000);") if False else c
c = c.replace("}, true);\n      setProspects", "}, true, 2000);\n      setProspects")
c = c.replace("}, true);\n      setEmails", "}, true, 4000);\n      setEmails")

with open('/Users/' + __import__('os').getlogin() + '/Desktop/sd-os/pages/index.jsx', 'w') as f:
    f.write(c)

print('Done')
