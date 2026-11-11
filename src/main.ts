import { mount } from 'svelte';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Elemento #app não encontrado');

export default mount(App, { target });
