import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getLiveArtistsForSite, getLiveMerchProducts, getLiveRevelationMedia, getLiveTapes, createPublicMerchReservation, type LiveMerchProduct, type LiveTape } from "@/lib/site-content";
import { getLiveCampingSessions, type CampingSessionRow } from "@/lib/camping-data";
import type { Artist } from "@/lib/artists";
import type { RevelationMedia } from "@/lib/revelacao-media";
import { frequency } from "@/lib/frequency";
import { tape } from "@/lib/tape-engine";
import { useKey } from "@/components/use-key";
import { useMember } from "@/components/use-member";
import { track } from "@/lib/track";
import { canReserveLiveProduct, getArtistSlotIndex, getCampingObjectSection, type CampingObjectSection } from "./camping-object-contracts";

type CartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  size: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

type Props = { focusedId: string; onClose: () => void };
type DataState<T> = { value: T; loading: boolean; error: string | null };

const EMPTY_ARTISTS: Artist[] = [];
const EMPTY_MERCH: LiveMerchProduct[] = [];
const EMPTY_TAPES: LiveTape[] = [];
const EMPTY_MEDIA: RevelationMedia[] = [];
const EMPTY_SESSIONS: CampingSessionRow[] = [];

function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem("sdt-camping-cart") || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartLine =>
      item && typeof item === "object" &&
      typeof item.key === "string" && typeof item.productId === "string" &&
      typeof item.name === "string" && typeof item.size === "string" &&
      Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0
    ).slice(0, 40);
  } catch {
    return [];
  }
}

function money(value: number): string {
  return new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN", maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-MZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function sectionName(section: CampingObjectSection): string {
  const labels: Record<CampingObjectSection, string> = {
    ROOT: "SYSTEM / DESKTOP",
    MUSIC: "MUSIC / RELEASE FILES",
    BEATS: "BEATS / PRODUCTION ARCHIVE",
    ARTISTS: "ARTISTS / PERSONNEL FILES",
    MERCH: "MERCH / DROP INVENTORY",
    ARCHIVE: "ARCHIVE / PUBLISHED RECORDS",
    SESSIONS: "SESSIONS / CAMPING LOG",
    LISTEN: "LISTENING ROOM / 808",
  };
  return labels[section];
}

function titleForObject(id: string): string {
  if (id === "studio.imac") return "XOYENS WORKSTATION";
  if (id === "studio.artists-wall" || id.startsWith("studio.artist-photo.")) return "PERSONNEL ARCHIVE";
  if (id === "studio.merch-rack") return "GARMENT INSPECTION";
  if (id === "studio.photo-backdrop") return "VISUAL RECORDS";
  if (id === "studio.production-desk") return "PRODUCTION DESK";
  if (id === "studio.audio-system") return "LISTENING ROOM";
  if (id === "studio.inner-door") return "ROOM 02 / THE ARCHIVE";
  return "OBJECT FILE";
}

function IconFolder({ code }: { code: string }) {
  return <span className="camping-object-folder__icon" aria-hidden="true"><span>{code}</span></span>;
}

export function CampingObjectInterface({ focusedId, onClose }: Props) {
  const initialSection = getCampingObjectSection(focusedId);
  const [section, setSection] = useState<CampingObjectSection>(initialSection);
  const [artists, setArtists] = useState<DataState<Artist[]>>({ value: EMPTY_ARTISTS, loading: false, error: null });
  const [merch, setMerch] = useState<DataState<LiveMerchProduct[]>>({ value: EMPTY_MERCH, loading: false, error: null });
  const [tapes, setTapes] = useState<DataState<LiveTape[]>>({ value: EMPTY_TAPES, loading: false, error: null });
  const [media, setMedia] = useState<DataState<RevelationMedia[]>>({ value: EMPTY_MEDIA, loading: false, error: null });
  const [sessions, setSessions] = useState<DataState<CampingSessionRow[]>>({ value: EMPTY_SESSIONS, loading: false, error: null });
  const [selectedArtistSlug, setSelectedArtistSlug] = useState<string | null>(null);
  const [forceArtistGrid, setForceArtistGrid] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [reservationAlias, setReservationAlias] = useState("");
  const [reservationBusy, setReservationBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const armed = useKey();
  const { member } = useMember();
  const [tapeState, setTapeState] = useState(tape.getState());
  const [radioState, setRadioState] = useState(frequency.getState());

  useEffect(() => tape.subscribe(() => setTapeState(tape.getState())), []);
  useEffect(() => frequency.subscribe(() => setRadioState(frequency.getState())), []);

  useEffect(() => {
    setSection(getCampingObjectSection(focusedId));
    setSelectedArtistSlug(null);
    setForceArtistGrid(false);
    setSelectedProductId(null);
    setSelectedSize("");
    setCartOpen(false);
    setFeedback(null);
    const slot = getArtistSlotIndex(focusedId);
    if (slot !== null) {
      setSelectedArtistSlug(null);
    }
  }, [focusedId]);

  useEffect(() => {
    try { window.localStorage.setItem("sdt-camping-cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (section === "ROOT" || section === "LISTEN") return;
      try {
        if (section === "ARTISTS") {
          setArtists((state) => ({ ...state, loading: true, error: null }));
          const value = await getLiveArtistsForSite();
          if (!cancelled) setArtists({ value, loading: false, error: null });
        } else if (section === "MERCH") {
          setMerch((state) => ({ ...state, loading: true, error: null }));
          const value = await getLiveMerchProducts();
          if (!cancelled) setMerch({ value, loading: false, error: null });
        } else if (section === "MUSIC") {
          setTapes((state) => ({ ...state, loading: true, error: null }));
          const value = await getLiveTapes();
          if (!cancelled) {
            tape.setQueue(value);
            setTapes({ value, loading: false, error: null });
          }
        } else if (section === "BEATS" || section === "ARCHIVE") {
          setMedia((state) => ({ ...state, loading: true, error: null }));
          const value = await getLiveRevelationMedia();
          if (!cancelled) setMedia({ value, loading: false, error: null });
        } else if (section === "SESSIONS") {
          setSessions((state) => ({ ...state, loading: true, error: null }));
          const value = await getLiveCampingSessions();
          if (!cancelled) setSessions({ value, loading: false, error: null });
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "O serviço não respondeu.";
        if (section === "ARTISTS") setArtists((state) => ({ ...state, loading: false, error: message }));
        if (section === "MERCH") setMerch((state) => ({ ...state, loading: false, error: message }));
        if (section === "MUSIC") setTapes((state) => ({ ...state, loading: false, error: message }));
        if (section === "BEATS" || section === "ARCHIVE") setMedia((state) => ({ ...state, loading: false, error: message }));
        if (section === "SESSIONS") setSessions((state) => ({ ...state, loading: false, error: message }));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [section]);

  useEffect(() => {
    if (member?.alias && !reservationAlias) setReservationAlias(member.alias);
  }, [member?.alias, reservationAlias]);

  const selectedArtist = useMemo(() => {
    if (selectedArtistSlug) return artists.value.find((artist) => artist.slug === selectedArtistSlug) ?? null;
    if (forceArtistGrid) return null;
    const slot = getArtistSlotIndex(focusedId);
    return slot === null ? null : artists.value[slot] ?? null;
  }, [artists.value, focusedId, forceArtistGrid, selectedArtistSlug]);

  const selectedProduct = merch.value.find((product) => product.id === selectedProductId) ?? null;
  const selectedVariant = selectedProduct?.variants.find((variant) => variant.size === selectedSize) ?? selectedProduct?.variants[0] ?? null;
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const sessionNow = Date.now();
  const beatMedia = media.value.filter((item) => /beat|instrumental|producer/i.test([item.roll, item.tag, item.caption, item.alt].join(" ")));

  function openFolder(next: CampingObjectSection) {
    setSection(next);
    setSelectedArtistSlug(null);
    setSelectedProductId(null);
    setSelectedSize("");
    setCartOpen(next === "MERCH" && cartOpen);
    setFeedback(null);
  }

  function addToCart(product: LiveMerchProduct) {
    const variant = product.variants.find((item) => item.size === selectedSize) ?? product.variants[0] ?? null;
    const size = variant?.size ?? "ÚNICO";
    const key = product.id + "::" + size;
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) return current.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, {
        key, productId: product.id, variantId: variant?.id ?? null, size,
        name: product.name, price: product.price, image: product.img || "", quantity: 1,
      }].slice(-40);
    });
    track("cart_add", { product: product.id, size });
    setFeedback({ tone: "ok", text: "PEÇA ADICIONADA AO SACO / " + product.name });
  }

  async function reserveCart() {
    if (!cart.length || reservationBusy) return;
    if (!armed && !member) {
      setFeedback({ tone: "info", text: "O COFRE EXIGE UMA CHAVE DE ESCUTA. OUÇA UMA FITA DURANTE 10 SEGUNDOS OU ENTRE COM O SEU SYNDICATE ID." });
      return;
    }
    const staticLine = cart.find((line) => !canReserveLiveProduct(line.productId));
    if (staticLine) {
      setFeedback({ tone: "info", text: "O CATÁLOGO PUBLICADO NÃO ESTÁ DISPONÍVEL PARA RESERVA DIRECTA. ABRA MERCH PARA CONSULTAR O FLUXO OFICIAL." });
      return;
    }
    setReservationBusy(true);
    setFeedback(null);
    const completed = new Set<string>();
    const receipts: string[] = [];
    try {
      for (const line of cart) {
        for (let quantity = 0; quantity < line.quantity; quantity++) {
          const result = await createPublicMerchReservation({
            productId: line.productId,
            productName: line.name,
            variantId: line.variantId,
            size: line.size,
            alias: reservationAlias || member?.alias || "",
            price: line.price,
          });
          receipts.push(String(result.code ?? result.reference ?? "RESERVA"));
        }
        completed.add(line.key);
      }
      track("reserve", { items: cartCount, value_mt: cartTotal });
      track("proof_sent", { items: cartCount });
      setCart((current) => current.filter((line) => !completed.has(line.key)));
      setFeedback({ tone: "ok", text: "RESERVAS REGISTADAS: " + receipts.join(" · ") });
      setCartOpen(false);
    } catch (error) {
      setCart((current) => current.filter((line) => !completed.has(line.key)));
      setFeedback({
        tone: "error",
        text: (error instanceof Error ? error.message : "Não foi possível concluir a reserva.") +
          (receipts.length ? " RESERVAS CONFIRMADAS: " + receipts.join(" · ") : ""),
      });
    } finally {
      setReservationBusy(false);
    }
  }

  function toggleTape(item: LiveTape) {
    frequency.stop();
    tape.toggle(item);
  }

  const slotIndex = getArtistSlotIndex(focusedId);
  const heading = section === "ROOT" ? "XOYENS / WORKSTATION" : sectionName(section);

  return (
    <section className="camping-object-interface" aria-label={"Interface interactiva " + titleForObject(focusedId)} data-testid="camping-object-interface">
      <div className="camping-object-interface__top">
        <div className="camping-object-interface__identity">
          <span className="camping-object-interface__stamp">808</span>
          <div>
            <p className="camping-object-interface__eyebrow">SINDICATE TERMINAL / 01</p>
            <h2>{titleForObject(focusedId)}</h2>
          </div>
        </div>
        <div className="camping-object-interface__top-actions">
          {cartCount > 0 && <button type="button" onClick={() => setCartOpen((open) => !open)} className="camping-object-interface__cart-toggle" aria-expanded={cartOpen}>BAG / {String(cartCount).padStart(2, "0")}</button>}
          <button type="button" className="camping-object-interface__close" onClick={onClose} aria-label="Fechar interface e regressar à cena 3D">×</button>
        </div>
      </div>

      <div className="camping-object-interface__meta">
        <span>OBJECT / {focusedId.toUpperCase().replace(/\./g, " / ")}</span>
        <span>ACCESS LEVEL / 808</span>
        <span>LIVE DATA WHEN PUBLISHED</span>
      </div>

      {section === "ROOT" && (
        <div className="camping-object-interface__body">
          <div className="camping-object-interface__desktop-intro">
            <p className="camping-object-interface__eyebrow">WORKSTATION / LOCAL NETWORK</p>
            <h3>SELECT FILE DIRECTORY</h3>
            <p>Conteúdo publicado do Sindicato. Seleccione uma pasta para abrir os registos associados ao projecto.</p>
          </div>
          <div className="camping-object-interface__folders">
            {([
              ["MUSIC", "MUSIC", "01"],
              ["BEATS", "BEATS", "02"],
              ["ARTISTS", "ARTISTS", "03"],
              ["MERCH", "MERCH", "04"],
              ["ARCHIVE", "ARCHIVE", "05"],
              ["SESSIONS", "SESSIONS", "06"],
            ] as const).map(([label, code, number]) => (
              <button type="button" className="camping-object-folder" key={label} onClick={() => openFolder(label as CampingObjectSection)}>
                <IconFolder code={number} />
                <span className="camping-object-folder__label">{label}</span>
                <span className="camping-object-folder__sub">{code} / OPEN FILES</span>
              </button>
            ))}
          </div>
          <div className="camping-object-interface__footer-note"><span>LOCAL STATION / 808</span><span>DO NOT REMOVE MEDIA</span></div>
        </div>
      )}

      {section !== "ROOT" && (
        <div className="camping-object-interface__body">
          <div className="camping-object-interface__section-head">
            <button type="button" onClick={() => openFolder(focusedId === "studio.imac" ? "ROOT" : getCampingObjectSection(focusedId))} className="camping-object-interface__back">← VOLTAR</button>
            <div><p className="camping-object-interface__eyebrow">DIRECTORY / 808</p><h3>{heading}</h3></div>
            {section === "MERCH" && <button type="button" className="camping-object-interface__cart-toggle" onClick={() => setCartOpen((open) => !open)}>BAG / {String(cartCount).padStart(2, "0")}</button>}
          </div>

          {section === "ARTISTS" && (
            <>
              {artists.loading && <p className="camping-object-interface__status">A LER OS FICHEIROS DE MEMBROS…</p>}
              {artists.error && <p className="camping-object-interface__status camping-object-interface__status--error">{artists.error}</p>}
              {!artists.loading && selectedArtist && (
                <article className="camping-object-dossier">
                  <div className="camping-object-dossier__photo">{selectedArtist.img && <img src={selectedArtist.img} alt={"Retrato de " + selectedArtist.name} />}</div>
                  <div className="camping-object-dossier__body">
                    <p className="camping-object-interface__eyebrow">PERSONNEL FILE / {selectedArtist.code}</p>
                    <h4>{selectedArtist.name}</h4>
                    <p className="camping-object-dossier__role">{selectedArtist.role} / {selectedArtist.zona}</p>
                    <p>{selectedArtist.bio}</p>
                    {selectedArtist.frase && <blockquote>“{selectedArtist.frase}”</blockquote>}
                    <div className="camping-object-dossier__tags">{selectedArtist.faixas?.map((trackName) => <span key={trackName}>{trackName}</span>)}</div>
                    <div className="camping-object-dossier__links">
                      {selectedArtist.spotifyArtistId && <a href={"https://open.spotify.com/artist/" + encodeURIComponent(selectedArtist.spotifyArtistId)} target="_blank" rel="noreferrer">SPOTIFY ↗</a>}
                      {selectedArtist.youtube?.map((video) => <a key={video.id} href={"https://www.youtube.com/watch?v=" + encodeURIComponent(video.youtubeId)} target="_blank" rel="noreferrer">{video.label.toUpperCase()} ↗</a>)}
                      <a href={"/membros/" + encodeURIComponent(selectedArtist.slug)}>FICHA COMPLETA ↗</a>
                    </div>
                    <button type="button" className="camping-object-interface__secondary" onClick={() => { setSelectedArtistSlug(null); setForceArtistGrid(true); }}>VOLTAR À PAREDE</button>
                  </div>
                </article>
              )}
              {!artists.loading && !selectedArtist && (
                <div className="camping-object-interface__artist-grid">
                  {artists.value.map((artist, index) => (
                    <button type="button" key={artist.slug} className="camping-object-artist" onClick={() => { setForceArtistGrid(false); setSelectedArtistSlug(artist.slug); }}>
                      <span className="camping-object-artist__photo">{artist.img && <img loading="lazy" src={artist.img} alt="" />}</span>
                      <span className="camping-object-artist__number">MEMBER / {String(index + 1).padStart(3, "0")}</span>
                      <strong>{artist.name}</strong>
                      <span className="camping-object-artist__code">{artist.code}</span>
                    </button>
                  ))}
                </div>
              )}
              {!artists.loading && !artists.value.length && !artists.error && <p className="camping-object-interface__empty">NENHUM PERFIL PUBLICADO NA FONTE ACTUAL.</p>}
            </>
          )}

          {section === "MUSIC" && (
            <>
              {tapes.loading && <p className="camping-object-interface__status">A LER O CATÁLOGO DE ÁUDIO…</p>}
              {tapes.error && <p className="camping-object-interface__status camping-object-interface__status--error">{tapes.error}</p>}
              <div className="camping-object-interface__media-list">
                {tapes.value.map((item, index) => {
                  const active = tapeState.id === item.id;
                  const playing = active && tapeState.playing;
                  return <div key={item.id} className="camping-object-track">
                    <span className="camping-object-track__index">{String(index + 1).padStart(2, "0")}</span>
                    <div className="camping-object-track__copy"><strong>{item.title}</strong><span>{item.feat} / {item.dur}</span></div>
                    <button type="button" onClick={() => toggleTape(item)} aria-label={(playing ? "Pausar " : "Ouvir ") + item.title}>{playing ? "PAUSAR" : active ? "RETOMAR" : "OUVIR"}</button>
                  </div>;
                })}
              </div>
              {!tapes.loading && !tapes.value.length && !tapes.error && <p className="camping-object-interface__empty">SEM FAIXAS PUBLICADAS.</p>}
              <p className="camping-object-interface__footnote">A reprodução utiliza o motor de áudio partilhado do site. A rádio é suspensa quando uma faixa local começa a tocar.</p>
            </>
          )}

          {section === "BEATS" && (
            <>
              {media.loading && <p className="camping-object-interface__status">A LER O ARQUIVO DE PRODUÇÃO…</p>}
              <p className="camping-object-interface__footnote">O código actual não expõe um catálogo de beats de áudio com BPM, produtor e ficheiros de preview. Esta vista não inventa faixas. Mostra apenas registos publicados que estão identificados como beats.</p>
              <div className="camping-object-interface__media-list">
                {beatMedia.map((item, index) => <a className="camping-object-track camping-object-track--link" key={item.id} href={"/revelacao?media=" + encodeURIComponent(item.id)}>
                  <span className="camping-object-track__index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="camping-object-track__copy"><strong>{item.caption || item.alt}</strong><span>{item.roll} / {item.type.toUpperCase()}</span></div>
                  <span>OPEN FILE ↗</span>
                </a>)}
              </div>
              {!media.loading && !beatMedia.length && <p className="camping-object-interface__empty">SEM REGISTOS DE BEATS PUBLICADOS. O CATÁLOGO DE ÁUDIO PRECISA DE UMA FONTE PRÓPRIA.</p>}
              <Link to="/frequencia" className="camping-object-interface__primary">ABRIR FREQUÊNCIA 808</Link>
            </>
          )}

          {section === "MERCH" && (
            <>
              {merch.loading && <p className="camping-object-interface__status">A LER PRODUTOS E VARIANTES…</p>}
              {merch.error && <p className="camping-object-interface__status camping-object-interface__status--error">{merch.error}</p>}
              {cartOpen ? (
                <div className="camping-object-cart">
                  <div className="camping-object-cart__top"><h4>MINI BAG / {cartCount} UN.</h4><span>{money(cartTotal)}</span></div>
                  {!cart.length && <p className="camping-object-interface__empty">O SACO ESTÁ VAZIO.</p>}
                  {cart.map((line) => <div key={line.key} className="camping-object-cart__line">
                    <div><strong>{line.name}</strong><span>{line.size} / {money(line.price)} × {line.quantity}</span></div>
                    <div className="camping-object-cart__actions">
                      <button type="button" onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))} aria-label={"Diminuir quantidade de " + line.name}>−</button>
                      <button type="button" onClick={() => setCart((current) => line.quantity <= 1 ? current.filter((item) => item.key !== line.key) : current.map((item) => item.key === line.key ? { ...item, quantity: item.quantity - 1 } : item))} aria-label={"Remover uma unidade de " + line.name}>REMOVER</button>
                      <button type="button" onClick={() => setCart((current) => current.map((item) => item.key === line.key ? { ...item, quantity: item.quantity + 1 } : item))} aria-label={"Aumentar quantidade de " + line.name}>+</button>
                    </div>
                  </div>)}
                  <label className="camping-object-cart__alias">NOME PARA RESERVA<input value={reservationAlias} maxLength={120} onChange={(event) => setReservationAlias(event.target.value)} placeholder={member?.alias || "ANÓNIMO"} /></label>
                  {(!armed && !member) && <p className="camping-object-interface__footnote">A reserva mantém o gate de merch existente: ouça uma fita durante 10 segundos ou entre com um Syndicate ID válido.</p>}
                  <button type="button" className="camping-object-interface__primary" disabled={!cart.length || reservationBusy || (!armed && !member)} onClick={() => void reserveCart()}>{reservationBusy ? "A REGISTAR RESERVA…" : "RESERVAR UNIDADES"}</button>
                  <Link to="/merch" className="camping-object-interface__secondary-link">ABRIR FLUXO COMPLETO DE MERCH ↗</Link>
                </div>
              ) : (
                <div className="camping-object-interface__product-grid">
                  {merch.value.map((product) => <button type="button" key={product.id} className={"camping-object-product" + (selectedProductId === product.id ? " is-selected" : "")} onClick={() => {
                    setSelectedProductId(product.id);
                    setSelectedSize(product.variants[0]?.size ?? "");
                    setFeedback(null);
                  }}>
                    <span className="camping-object-product__image">{product.img && <img loading="lazy" src={product.img} alt="" />}</span>
                    <span className="camping-object-product__code">DROP / {product.n}</span>
                    <strong>{product.name}</strong>
                    <span className="camping-object-product__price">{money(product.price)}</span>
                    <span className="camping-object-product__stock">{product.left > 0 ? product.left + " UNIDADES INDICADAS" : "STOCK ESGOTADO"}</span>
                  </button>)}
                </div>
              )}
              {!cartOpen && selectedProduct && (
                <div className="camping-object-product-detail">
                  <div className="camping-object-product-detail__heading"><div><p className="camping-object-interface__eyebrow">PRODUCT FILE / {selectedProduct.n}</p><h4>{selectedProduct.name}</h4><p>{selectedProduct.spec || selectedProduct.sub}</p></div><strong>{money(selectedProduct.price)}</strong></div>
                  {selectedProduct.detail?.length > 0 && <ul>{selectedProduct.detail.map((item) => <li key={item}>{item}</li>)}</ul>}
                  <label className="camping-object-product-detail__size">SELECT SIZE
                    <select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
                      {selectedProduct.variants.map((variant) => <option key={variant.id} value={variant.size}>{variant.size} / {Math.max(0, variant.stockTotal - variant.stockReserved - variant.stockSold)} DISP.</option>)}
                    </select>
                  </label>
                  <div className="camping-object-product-detail__actions">
                    <button type="button" disabled={selectedProduct.left <= 0 || (!selectedProduct.variants.length && selectedProduct.n !== "04")} onClick={() => addToCart(selectedProduct)}>ADD TO BAG</button>
                    <button type="button" onClick={() => setCartOpen(true)}>VIEW BAG / {cartCount}</button>
                    <Link to="/merch" className="camping-object-interface__primary">BUY NOW ↗</Link>
                  </div>
                  {selectedProduct.id.startsWith("static-") && <p className="camping-object-interface__footnote">A apresentar catálogo de contingência. Para reservar, abra a página MERCH e confirme o catálogo publicado.</p>}
                </div>
              )}
              {!merch.loading && !merch.value.length && !merch.error && <p className="camping-object-interface__empty">SEM PRODUTOS PUBLICADOS.</p>}
            </>
          )}

          {section === "ARCHIVE" && (
            <>
              {media.loading && <p className="camping-object-interface__status">A ABRIR ARQUIVO…</p>}
              {media.error && <p className="camping-object-interface__status camping-object-interface__status--error">{media.error}</p>}
              <p className="camping-object-interface__footnote">{focusedId === "studio.inner-door" ? "ROOM 02 / ARQUIVO DIGITAL. Os ficheiros abaixo são apenas os registos que a fonte actual publica. Conteúdo restrito exige autorização no backend." : "REGISTOS VISUAIS PUBLICADOS / SEM ACESSO A FICHEIROS PRIVADOS."}</p>
              <div className="camping-object-interface__archive-grid">
                {media.value.filter((item) => !/beat|instrumental/i.test([item.roll, item.tag].join(" "))).map((item, index) => <a key={item.id} className="camping-object-archive-item" href={"/revelacao?media=" + encodeURIComponent(item.id)}>
                  <span className="camping-object-archive-item__image">{item.type === "image" && <img loading="lazy" src={item.src} alt={item.alt} />}{item.type === "video" && item.poster && <img loading="lazy" src={item.poster} alt="" />}</span>
                  <span className="camping-object-archive-item__meta">ARCHIVE / {String(index + 1).padStart(3, "0")} · {item.roll}</span>
                  <strong>{item.caption || item.alt}</strong>
                  <span>VIEW FILE ↗</span>
                </a>)}
              </div>
              {!media.loading && !media.value.length && !media.error && <p className="camping-object-interface__empty">SEM REGISTOS PÚBLICOS DISPONÍVEIS.</p>}
              {focusedId === "studio.inner-door" && <p className="camping-object-interface__empty">A SALA ARQUITECTÓNICA ROOM 02 AINDA NÃO ESTÁ MODELADA. ESTE TERMINAL SÓ EXPÕE REGISTOS PUBLICADOS.</p>}
            </>
          )}

          {section === "SESSIONS" && (
            <>
              {sessions.loading && <p className="camping-object-interface__status">A LER SESSÕES DO CAMPING…</p>}
              {sessions.error && <p className="camping-object-interface__status camping-object-interface__status--error">{sessions.error}</p>}
              <div className="camping-object-interface__session-list">
                {sessions.value.map((item) => {
                  const starts = new Date(item.startsAt).getTime();
                  const ends = new Date(item.endsAt).getTime();
                  const live = starts <= sessionNow && ends > sessionNow;
                  const upcoming = starts > sessionNow;
                  return <article key={item.id} className="camping-object-session">
                    <span className={"camping-object-session__status" + (live ? " is-live" : "")}>{live ? "● LIVE" : upcoming ? "SCHEDULED" : "ARCHIVED"}</span>
                    <div><h4>{item.title}</h4><p>{item.roomName} / {item.galleryTag}</p><span>{dateLabel(item.startsAt)} → {dateLabel(item.endsAt)}</span></div>
                    <span className="camping-object-session__day">DAY / {String(item.day).padStart(2, "0")}</span>
                  </article>;
                })}
              </div>
              {!sessions.loading && !sessions.value.length && !sessions.error && <p className="camping-object-interface__empty">SEM SESSÕES PUBLICADAS. Os dados são fornecidos pelo serviço CAMPING actual.</p>}
              <Link to="/frequencia" className="camping-object-interface__primary">OUVIR FREQUÊNCIA 808 ↗</Link>
            </>
          )}

          {section === "LISTEN" && (
            <div className="camping-object-listening">
              <p className="camping-object-interface__eyebrow">SINDICATE RADIO / LIVE</p>
              <h4>{radioState.current?.title || "FREQUÊNCIA 808"}</h4>
              <p>{radioState.current?.artist || "RÁDIO SINDICATO DO TRAP"}</p>
              <p className="camping-object-interface__footnote">Controlos ligados à emissão real. A reprodução de uma fita no computador e a rádio partilham o controlo de áudio para evitar dois sinais concorrentes.</p>
              <div className="camping-object-listening__status"><span className={radioState.playing ? "is-live" : ""} />{radioState.playing ? "NO AR" : radioState.active ? "PAUSADA" : "FORA DO AR"}</div>
              <div className="camping-object-product-detail__actions">
                <button type="button" onClick={() => void frequency.resume()}>{radioState.active ? "RETOMAR" : "SINTONIZAR"}</button>
                <button type="button" onClick={() => frequency.pause()}>PAUSAR</button>
                <button type="button" onClick={() => frequency.stop()}>DESLIGAR RÁDIO</button>
                <Link to="/frequencia" className="camping-object-interface__primary">ABRIR EMISSÃO COMPLETA ↗</Link>
              </div>
            </div>
          )}

          {feedback && <p className={"camping-object-interface__feedback camping-object-interface__feedback--" + feedback.tone} role="status">{feedback.text}</p>}
        </div>
      )}

      <div className="camping-object-interface__bottom"><span>SYNDICATE / INTERNAL SYSTEMS</span><span>SESSION / 808</span></div>
    </section>
  );
}
