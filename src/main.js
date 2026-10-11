import './style.css';
import defaultData from '../public/data/products.json';

// ============================================
// BURGER PAULISTA — MAIN APPLICATION
// ============================================

// === STATE ===
let DATA = defaultData;
let cart = [];
let activeCategory = 'all';
let currentProduct = null;
let modalQuantity = 1;
let selectedAddons = [];

// === DOM REFS ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === RESOLVE IMAGE URL ===
function resolveImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('./')) return path;
  if (path.startsWith('/')) return '.' + path;
  return './' + path;
}

// === INIT ===
async function init() {
  DATA = defaultData;

  try {
    const res = await fetch('./data/products.json');
    if (res.ok) {
      const fetched = await res.json();
      if (fetched && fetched.products && fetched.products.length > 0) {
        DATA = fetched;
      }
    }
  } catch (err) {
    console.warn('Usando dados locais de produtos:', err);
  }

  // Update dynamic store info in header/hero
  if (DATA && DATA.config) {
    const addrEl = $('#storeAddress');
    if (addrEl && DATA.config.address) addrEl.textContent = DATA.config.address;

    const timeEl = $('#deliveryTime');
    if (timeEl && DATA.config.deliveryTime) timeEl.textContent = DATA.config.deliveryTime;

    const feeEl = $('#deliveryFeeDisplay');
    if (feeEl && DATA.config.deliveryFee !== undefined) feeEl.textContent = formatPrice(DATA.config.deliveryFee);
  }

  renderCategories();
  renderProducts();
  setupEventListeners();
  setupScrollReveal();
  setupHeaderScroll();
}

// === FORMAT CURRENCY ===
function formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// === RENDER CATEGORIES ===
function renderCategories() {
  const container = $('#categoriesList');
  if (!container || !DATA || !DATA.categories) return;
  container.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.className = 'category-chip active';
  allChip.dataset.category = 'all';
  allChip.innerHTML = `<span class="category-chip__icon">📋</span> Todos`;
  container.appendChild(allChip);

  DATA.categories.forEach((cat) => {
    const chip = document.createElement('button');
    chip.className = 'category-chip';
    chip.dataset.category = cat.id;
    chip.innerHTML = `<span class="category-chip__icon">${cat.icon}</span> ${cat.name}`;
    container.appendChild(chip);
  });
}

// === RENDER PRODUCTS ===
function renderProducts(searchTerm = '') {
  const container = $('#productsContainer');
  container.innerHTML = '';

  const term = searchTerm.toLowerCase().trim();
  let filteredProducts = DATA.products;

  if (term) {
    filteredProducts = filteredProducts.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    );
  }

  if (activeCategory !== 'all') {
    filteredProducts = filteredProducts.filter((p) => p.category === activeCategory);
  }

  if (filteredProducts.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <div class="no-results__icon">🔍</div>
        <p class="no-results__text">Nenhum produto encontrado</p>
      </div>
    `;
    return;
  }

  // Group by category
  const grouped = {};
  filteredProducts.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  const categoryOrder = DATA.categories.map((c) => c.id);

  categoryOrder.forEach((catId) => {
    if (!grouped[catId]) return;
    const cat = DATA.categories.find((c) => c.id === catId);
    const group = document.createElement('section');
    group.className = 'category-group reveal';
    group.id = catId;
    group.innerHTML = `
      <h2 class="category-group__title">
        <span class="category-group__title-icon">${cat.icon}</span>
        ${cat.name}
      </h2>
      <div class="products-grid"></div>
    `;
    const grid = group.querySelector('.products-grid');

    grouped[catId].forEach((product) => {
      grid.appendChild(createProductCard(product));
    });

    container.appendChild(group);
  });

  // Re-apply scroll reveal
  setupScrollReveal();
}

// === CREATE PRODUCT CARD ===
function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.productId = product.id;
  const imgSrc = resolveImageUrl(product.image);
  card.innerHTML = `
    <div class="product-card__image-wrapper">
      <img class="product-card__image" src="${imgSrc}" alt="${product.name}" loading="lazy" />
      ${product.badge ? `<span class="product-card__badge">${product.badge}</span>` : ''}
    </div>
    <div class="product-card__body">
      <h3 class="product-card__name">${product.name}</h3>
      <p class="product-card__desc">${product.description}</p>
      <div class="product-card__footer">
        <span class="product-card__price">${formatPrice(product.price)}</span>
        <button class="product-card__add-btn" aria-label="Adicionar ${product.name}">+</button>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    openProductModal(product);
  });

  return card;
}

// === PRODUCT MODAL ===
function openProductModal(product) {
  currentProduct = product;
  modalQuantity = 1;
  selectedAddons = [];

  $('#modalImage').src = resolveImageUrl(product.image);
  $('#modalImage').alt = product.name;
  $('#modalTitle').textContent = product.name;
  $('#modalDescription').textContent = product.description;
  $('#modalPrice').textContent = formatPrice(product.price);
  $('#modalQtyValue').textContent = '1';
  $('#modalObs').value = '';

  // Badge
  const badge = $('#modalBadge');
  if (product.badge) {
    badge.textContent = product.badge;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }

  // Addons
  const addonsSection = $('#addonsSection');
  const addonsList = $('#addonsList');
  addonsList.innerHTML = '';
  if (product.addons && product.addons.length > 0) {
    addonsSection.style.display = 'block';
    product.addons.forEach((addon, i) => {
      const opt = createOptionElement(addon.name, addon.price > 0 ? `+ ${formatPrice(addon.price)}` : 'Grátis', 'addon', i);
      addonsList.appendChild(opt);
    });
  } else {
    addonsSection.style.display = 'none';
  }

  updateModalTotal();
  $('#productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function createOptionElement(name, priceText, type, index) {
  const opt = document.createElement('div');
  opt.className = 'modal__option';
  opt.dataset.type = type;
  opt.dataset.index = index;
  opt.innerHTML = `
    <span class="modal__option-checkbox">✓</span>
    <span class="modal__option-name">${name}</span>
    ${priceText ? `<span class="modal__option-price">${priceText}</span>` : ''}
  `;
  opt.addEventListener('click', () => toggleOption(opt, type, index));
  return opt;
}

function toggleOption(el, type, index) {
  el.classList.toggle('selected');
  if (type === 'addon') {
    if (el.classList.contains('selected')) {
      selectedAddons.push(index);
    } else {
      selectedAddons = selectedAddons.filter((i) => i !== index);
    }
  }
  updateModalTotal();
}

function updateModalTotal() {
  if (!currentProduct) return;
  let total = currentProduct.price;
  selectedAddons.forEach((i) => {
    total += currentProduct.addons[i].price;
  });
  total *= modalQuantity;
  $('#modalTotalPrice').textContent = formatPrice(total);
}

function closeProductModal() {
  $('#productModal').classList.remove('open');
  document.body.style.overflow = '';
  currentProduct = null;
}

// === CART LOGIC ===
function addToCart() {
  if (!currentProduct) return;

  const addons = selectedAddons.map((i) => currentProduct.addons[i]);
  const obs = $('#modalObs').value.trim();

  let itemPrice = currentProduct.price;
  addons.forEach((a) => { itemPrice += a.price; });

  const cartItem = {
    id: Date.now(),
    productId: currentProduct.id,
    name: currentProduct.name,
    image: currentProduct.image,
    basePrice: currentProduct.price,
    unitPrice: itemPrice,
    quantity: modalQuantity,
    addons: addons,
    obs: obs,
  };

  cart.push(cartItem);
  updateCartUI();
  closeProductModal();
  showToast(`${currentProduct.name} adicionado!`);
  openCart();
}

function removeFromCart(cartItemId) {
  cart = cart.filter((item) => item.id !== cartItemId);
  updateCartUI();
  if (cart.length === 0) {
    closeCart();
  }
}

function updateCartItemQty(cartItemId, delta) {
  const item = cart.find((i) => i.id === cartItemId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(cartItemId);
  } else {
    updateCartUI();
  }
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartUI() {
  // Badge
  const count = getCartCount();
  const badge = $('#cartBadge');
  badge.textContent = count;
  if (count > 0) {
    badge.classList.add('active');
  } else {
    badge.classList.remove('active');
  }

  // Cart items
  const container = $('#cartItems');
  const emptyEl = $('#cartEmpty');
  const checkoutEl = $('#cartCheckout');

  if (cart.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyEl);
    emptyEl.style.display = 'block';
    checkoutEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  checkoutEl.style.display = 'block';
  container.innerHTML = '';

  cart.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'cart-item';

    let details = '';
    if (item.addons && item.addons.length > 0) {
      details += item.addons.map((a) => `+ ${a.name}`).join(', ');
    }
    if (item.obs) {
      if (details) details += ' | ';
      details += `Obs: ${item.obs}`;
    }

    el.innerHTML = `
      <img class="cart-item__image" src="${resolveImageUrl(item.image)}" alt="${item.name}" loading="lazy" />
      <div class="cart-item__info">
        <div class="cart-item__name">${item.name}</div>
        ${details ? `<div class="cart-item__details">${details}</div>` : ''}
        <div class="cart-item__bottom">
          <span class="cart-item__price">${formatPrice(item.unitPrice * item.quantity)}</span>
          <div class="cart-item__controls">
            <button class="cart-item__qty-btn ${item.quantity === 1 ? 'cart-item__qty-btn--remove' : ''}" data-action="minus" data-id="${item.id}" aria-label="Diminuir">${item.quantity === 1 ? '🗑' : '−'}</button>
            <span class="cart-item__qty">${item.quantity}</span>
            <button class="cart-item__qty-btn" data-action="plus" data-id="${item.id}" aria-label="Aumentar">+</button>
          </div>
        </div>
      </div>
    `;

    // Event delegation for quantity buttons
    el.querySelectorAll('.cart-item__qty-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.id);
        const action = btn.dataset.action;
        if (action === 'plus') updateCartItemQty(id, 1);
        else updateCartItemQty(id, -1);
      });
    });

    container.appendChild(el);
  });

  // Update checkout totals
  const subtotal = getCartTotal();
  const deliveryFee = DATA.config.deliveryFee;
  const total = subtotal + deliveryFee;

  $('#checkoutSubtotal').textContent = formatPrice(subtotal);
  $('#checkoutDeliveryFee').textContent = formatPrice(deliveryFee);
  $('#checkoutTotal').textContent = formatPrice(total);
}

// === CART SIDEBAR ===
function openCart() {
  $('#cartSidebar').classList.add('open');
  $('#cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  $('#cartSidebar').classList.remove('open');
  $('#cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// === TOAST ===
function showToast(message) {
  const toast = $('#toast');
  $('#toastMessage').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// === CHECKOUT / WHATSAPP ===
function submitOrder() {
  if (cart.length === 0) return;

  // Validate
  const name = $('#checkoutName').value.trim();
  const address = $('#checkoutAddress').value.trim();
  const setor = $('#checkoutSetor').value.trim();
  const reference = $('#checkoutReference') ? $('#checkoutReference').value.trim() : '';
  const payment = $('#checkoutPayment').value;

  let hasError = false;

  // Remove previous errors
  $$('.checkout__field input, .checkout__field select').forEach((el) => el.classList.remove('error'));

  if (!name) { $('#checkoutName').classList.add('error'); hasError = true; }
  if (!address) { $('#checkoutAddress').classList.add('error'); hasError = true; }
  if (!setor) { $('#checkoutSetor').classList.add('error'); hasError = true; }
  if (!payment) { $('#checkoutPayment').classList.add('error'); hasError = true; }

  if (hasError) {
    showToast('Preencha todos os campos obrigatórios');
    return;
  }

  // Build message
  let msg = `🍔 *PEDIDO — BURGER PAULISTA*\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  cart.forEach((item, i) => {
    msg += `*${i + 1}. ${item.name}*\n`;
    msg += `   Qtd: ${item.quantity} × ${formatPrice(item.unitPrice)}\n`;
    if (item.addons && item.addons.length > 0) {
      msg += `   Adicionais: ${item.addons.map((a) => `${a.name} (+${formatPrice(a.price)})`).join(', ')}\n`;
    }
    if (item.obs) {
      msg += `   Obs: ${item.obs}\n`;
    }
    msg += `   Subtotal: *${formatPrice(item.unitPrice * item.quantity)}*\n\n`;
  });

  const subtotal = getCartTotal();
  const deliveryFee = DATA.config.deliveryFee;
  const total = subtotal + deliveryFee;

  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 Subtotal: ${formatPrice(subtotal)}\n`;
  msg += `🚚 Taxa de entrega: ${formatPrice(deliveryFee)}\n`;
  msg += `💰 *TOTAL: ${formatPrice(total)}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📍 *Dados de Entrega:*\n`;
  msg += `Nome: ${name}\n`;
  msg += `Endereço: ${address}\n`;
  msg += `Setor: ${setor}\n`;
  if (reference) {
    msg += `Ponto de Referência: ${reference}\n`;
  }
  msg += `\n`;

  const paymentLabel = payment === 'pix' ? 'Pix' : 'Pagar na Entrega (Cartão/Dinheiro)';
  msg += `💳 *Pagamento:* ${paymentLabel}\n`;

  if (payment === 'pix') {
    msg += `🔑 Chave Pix: ${DATA.config.pixKey}\n`;
  }

  msg += `\n⏰ Tempo estimado: ${DATA.config.deliveryTime}\n`;
  msg += `\n_Pedido enviado pelo cardápio digital Burger Paulista_`;

  const encoded = encodeURIComponent(msg);
  const url = `https://wa.me/${DATA.config.whatsapp}?text=${encoded}`;
  window.open(url, '_blank');
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Category chips
  $('#categoriesList').addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;
    $$('.category-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeCategory = chip.dataset.category;
    renderProducts($('#searchInput').value);
  });

  // Search
  const searchInput = $('#searchInput');
  const searchClear = $('#searchClear');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchClear.style.display = searchInput.value ? 'flex' : 'none';
    searchTimeout = setTimeout(() => {
      renderProducts(searchInput.value);
    }, 250);
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.style.display = 'none';
    renderProducts();
    searchInput.focus();
  });

  // Modal close
  $('#modalClose').addEventListener('click', closeProductModal);
  $('#productModal').addEventListener('click', (e) => {
    if (e.target === $('#productModal')) closeProductModal();
  });

  // Modal quantity
  $('#modalQtyMinus').addEventListener('click', () => {
    if (modalQuantity > 1) {
      modalQuantity--;
      $('#modalQtyValue').textContent = modalQuantity;
      updateModalTotal();
    }
  });
  $('#modalQtyPlus').addEventListener('click', () => {
    modalQuantity++;
    $('#modalQtyValue').textContent = modalQuantity;
    updateModalTotal();
  });

  // Modal add to cart
  $('#modalAddBtn').addEventListener('click', addToCart);

  // Cart toggle
  $('#cartToggleBtn').addEventListener('click', openCart);
  $('#cartCloseBtn').addEventListener('click', closeCart);
  $('#cartOverlay').addEventListener('click', closeCart);

  // Payment select - show/hide pix
  $('#checkoutPayment').addEventListener('change', (e) => {
    const pixBox = $('#pixBox');
    pixBox.style.display = e.target.value === 'pix' ? 'block' : 'none';
  });

  // Pix copy
  $('#pixCopyBtn').addEventListener('click', () => {
    const pixKey = DATA.config.pixKey;
    navigator.clipboard.writeText(pixKey).then(() => {
      showToast('Chave Pix copiada!');
      $('#pixCopyBtn').textContent = '✓ Copiado!';
      setTimeout(() => {
        $('#pixCopyBtn').textContent = '📋 Copie para PAGAR AGORA';
      }, 2000);
    }).catch(() => {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = pixKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Chave Pix copiada!');
    });
  });

  // Checkout submit
  $('#checkoutSubmitBtn').addEventListener('click', submitOrder);

  // Keyboard: Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#productModal').classList.contains('open')) closeProductModal();
      else if ($('#cartSidebar').classList.contains('open')) closeCart();
    }
  });
}

// === SCROLL REVEAL ===
function setupScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  $$('.reveal').forEach((el) => {
    if (!el.classList.contains('visible')) {
      observer.observe(el);
    }
  });
}

// === HEADER SCROLL EFFECT ===
function setupHeaderScroll() {
  const header = $('#header');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        header.classList.toggle('scrolled', window.scrollY > 10);
        ticking = false;
      });
      ticking = true;
    }
  });
}

// === START ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
