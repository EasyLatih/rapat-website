import { db } from './gig-config.js';

const $ = id => document.getElementById(id);

async function loadBrowseServices() {
  const select = $('browseServiceFilter');
  if (!select) return;

  const [{ data: categories, error: categoryError }, { data: services, error: serviceError }] = await Promise.all([
    db.from('gig_categories')
      .select('id,name,slug,sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name'),
    db.from('gig_services')
      .select('id,category_id,name,slug,sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name')
  ]);

  if (categoryError || serviceError) {
    select.innerHTML = '<option value="">Senarai servis tidak tersedia</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = '<option value="">Browse semua servis</option>';

  for (const category of categories || []) {
    const categoryServices = (services || []).filter(service =>
      service.category_id === category.id && service.slug !== 'servis-lain-lain'
    );
    if (!categoryServices.length) continue;

    const group = document.createElement('optgroup');
    group.label = category.name;

    for (const service of categoryServices) {
      const option = document.createElement('option');
      option.value = service.name;
      option.textContent = service.name;
      group.appendChild(option);
    }

    select.appendChild(group);
  }

  const currentKeyword = $('keywordFilter')?.value?.trim().toLowerCase();
  if (currentKeyword) {
    const match = [...select.options].find(option => option.value.toLowerCase() === currentKeyword);
    if (match) select.value = match.value;
  }
}

function handleBrowseSelection() {
  const select = $('browseServiceFilter');
  const keyword = $('keywordFilter');
  if (!select || !keyword || !select.value) return;
  keyword.value = select.value;
  $('searchBtn')?.click();
}

$('browseServiceFilter')?.addEventListener('change', handleBrowseSelection);
loadBrowseServices();
