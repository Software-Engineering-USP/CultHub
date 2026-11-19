"""Configuração do gunicorn na imagem de produção (ver Dockerfile da raiz)."""

import os

# A hospedagem informa a porta em PORT.
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"

# Um worker só: o cache e a trava de 1 pedido por segundo do OSRM são por
# processo.
workers = 1
threads = 4

# Log de acesso só com o caminho, sem a query string: a busca de endereço
# e a rota recebem o endereço digitado e coordenadas (mesmo cuidado de
# `rotas/logs.py` no runserver). O X-Forwarded-For mostra os proxies na
# frente do serviço, que é o que define DJANGO_NUM_PROXIES.
accesslog = "-"
access_log_format = '%({x-forwarded-for}i)s "%(m)s %(U)s" %(s)s %(b)s %(M)sms'
