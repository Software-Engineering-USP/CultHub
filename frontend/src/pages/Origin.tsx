import EventStrip from '../components/events/EventStrip'
import BackLink from '../components/ui/BackLink'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import { Button } from '../components/ui/Button'
import DemoNote from '../components/ui/DemoNote'
import Field from '../components/ui/Field'
import IconTile from '../components/ui/IconTile'
import { LocateIcon } from '../components/ui/Icons'
import NotFound from '../components/ui/NotFound'
import SectionHeading from '../components/ui/SectionHeading'
import StatusBadge from '../components/ui/StatusBadge'
import Surface from '../components/ui/Surface'
import TextLink from '../components/ui/TextLink'
import WeatherStrip from '../components/weather/WeatherStrip'
import { demoRoutes } from '../data/events'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useEvent } from '../hooks/useEvent'
import { peerFocusRing } from '../lib/classes'
import { preventSubmit } from '../lib/forms'

export default function Origin() {
  const event = useEvent()
  useDocumentTitle('Defina sua origem | CultHub')

  if (!event?.details) {
    return <NotFound message="Não encontramos o evento para planejar a visita." />
  }

  const base = `/eventos/${event.id}`

  return (
    <>
      <BackLink to={base}>← Voltar para o evento</BackLink>
      <Breadcrumbs
        items={[
          { label: 'Explorar', to: '/' },
          { label: event.shortTitle ?? event.title, to: base },
          { label: 'Como chegar' },
        ]}
      />

      <SectionHeading
        as="h1"
        variant="page"
        title="Como chegar"
        description="Seu próximo encontro com a música começa com um ponto de partida."
      >
        <StatusBadge>◎ Defina sua origem para começar</StatusBadge>
      </SectionHeading>

      <EventStrip event={event} />

      <div className="grid grid-cols-[minmax(300px,400fr)_minmax(0,856fr)] items-start gap-6 max-lg:grid-cols-[minmax(300px,.9fr)_minmax(0,1.5fr)] max-md:grid-cols-[minmax(0,1fr)]">
        <Surface
          as="section"
          aria-labelledby="origem-titulo"
          padded={false}
          className="p-6 max-md:p-7 max-sm:p-[21px]"
        >
          <div className="mb-5 flex items-center gap-3">
            <IconTile>
              <LocateIcon className="h-[23px] w-[23px]" />
            </IconTile>
            <h2 id="origem-titulo" className="text-[20px] max-sm:text-[18px]">
              De onde você vai sair?
            </h2>
          </div>

          <div className="mb-4 rounded-[13px] border border-line bg-[#f7f2e9] px-4 py-[14px]">
            <strong className="mb-[6px] block text-[12px] text-maroon">Localização indisponível</strong>
            <p className="text-[11px]">
              Não temos sua localização. Você pode permitir o uso para definir a origem ou informar um
              endereço, como preferir.
            </p>
          </div>

          <Button block disabled aria-describedby="geolocalizacao-aviso">
            ◎ Usar minha localização (demo)
          </Button>
          <DemoNote id="geolocalizacao-aviso" size="xs" className="mt-[10px]">
            Demonstração visual: nenhuma localização é solicitada ou coletada.
          </DemoNote>

          <div className="my-[17px] flex items-center gap-[10px] text-[10px] text-muted before:h-px before:flex-1 before:bg-line before:content-[''] after:h-px after:flex-1 after:bg-line after:content-['']">
            ou informe a partida
          </div>

          <form
            aria-label="Definir partida (demonstração)"
            aria-describedby="planejamento-aviso"
            autoComplete="off"
            onSubmit={preventSubmit}
          >
            <Field
              id="endereco"
              label="Endereço de partida"
              type="text"
              placeholder="Digite um endereço de partida"
              autoComplete="off"
              help="Informe rua, número e cidade. Use apenas um endereço fictício neste exemplo."
            />

            <div className="my-4 rounded-xl border border-line bg-[#f6ecdd] px-[15px] py-3">
              <small className="block text-[10px] text-muted">Destino</small>
              <strong className="text-[12px]">{event.venue}</strong>
            </div>

            <fieldset aria-describedby="transporte-aviso" className="mb-[18px] min-w-0">
              <legend className="mb-[9px] text-[11px] font-[650]">Como você quer ir?</legend>
              <div className="grid grid-cols-3 gap-[7px]">
                {demoRoutes.map((route) => (
                  <div key={route.id} className="relative">
                    <input
                      id={route.id}
                      name="transporte"
                      type="radio"
                      value={route.id}
                      defaultChecked={route.id === 'carro'}
                      className="peer absolute left-[10px] top-3 mt-[2px] h-[13px] w-[13px] accent-maroon"
                    />
                    <label
                      htmlFor={route.id}
                      className={`block rounded-[10px] border border-line bg-surface py-[10px] pl-7 pr-2 text-center text-[10px] max-md:text-[12px] max-sm:text-[10px] peer-checked:border-[#c1884f] peer-checked:bg-[#ffe4bd] peer-checked:font-bold peer-checked:text-maroon ${peerFocusRing}`}
                    >
                      {route.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>

            <DemoNote id="transporte-aviso" size="xs" className="mb-[14px] mt-[10px]">
              A escolha é apenas visual e não altera o mapa.
            </DemoNote>

            <Button type="submit" block disabled>
              Traçar rota <span aria-hidden="true">→</span>
            </Button>
            <DemoNote id="planejamento-aviso" size="xs" className="mt-[10px]">
              Defina a partida para habilitar o planejamento.
              <br />
              Nesta versão estática, o planejamento permanece desativado mesmo após preencher o campo.
              Nenhum endereço é enviado.
            </DemoNote>
          </form>

          <TextLink to={`${base}/rota`} className="mt-4 block text-center">
            Ver rota de exemplo →
          </TextLink>

          <DemoNote size="xs" className="mt-[18px] border-t border-line pt-[15px]">
            Sua localização só deverá ser usada com seu consentimento em uma versão integrada. Aqui não há
            geolocalização, consulta de endereços ou armazenamento de dados.
          </DemoNote>
        </Surface>

        <figure>
          <img
            className="block w-full rounded-3xl border border-line"
            src="/assets/mapa-origem.png"
            width={856}
            height={690}
            alt="Mapa ilustrativo da região do Ibirapuera na tela de definição da origem, sem ponto de partida real. Os controles desenhados fazem parte da imagem e não são interativos."
          />
          <DemoNote as="figcaption" className="mt-[10px]">
            Mapa estático do layout de referência. Origem não definida; não é um serviço de mapas ou
            navegação.
          </DemoNote>
        </figure>
      </div>

      <WeatherStrip event={event} />
    </>
  )
}
