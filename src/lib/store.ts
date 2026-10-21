import bcrypt from 'bcryptjs';
import { assertSupabaseClient } from './supabase.js';

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  stock: number;
  featured?: boolean;
  credentials?: {
    username?: string;
    password?: string;
    email?: string;
    recoveryEmail?: string;
    notes?: string;
  };
};

type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  password?: string;
  walletBalance: number;
  createdAt: string;
};

type Order = {
  id: string;
  userId: string;
  productId: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
};

type WalletTransaction = {
  id: string;
  userId: string;
  type: 'deposit' | 'purchase';
  amount: number;
  description: string;
  createdAt: string;
};

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function parseCredentials(raw: unknown) {
  if (!raw) return undefined;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return {
        username: typeof parsed?.username === 'string' ? parsed.username : '',
        password: typeof parsed?.password === 'string' ? parsed.password : '',
        email: typeof parsed?.email === 'string' ? parsed.email : '',
        recoveryEmail: typeof parsed?.recoveryEmail === 'string' ? parsed.recoveryEmail : '',
        notes: typeof parsed?.notes === 'string' ? parsed.notes : '',
      };
    } catch {
      return undefined;
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    return {
      username: typeof (raw as { username?: unknown }).username === 'string' ? (raw as { username?: string }).username : '',
      password: typeof (raw as { password?: unknown }).password === 'string' ? (raw as { password?: string }).password : '',
      email: typeof (raw as { email?: unknown }).email === 'string' ? (raw as { email?: string }).email : '',
      recoveryEmail: typeof (raw as { recoveryEmail?: unknown }).recoveryEmail === 'string' ? (raw as { recoveryEmail?: string }).recoveryEmail : '',
      notes: typeof (raw as { notes?: unknown }).notes === 'string' ? (raw as { notes?: string }).notes : '',
    };
  }

  return undefined;
}

function serializeCredentials(credentials?: Product['credentials']) {
  if (!credentials) return null;
  return JSON.stringify(credentials);
}

export async function verifyPassword(inputPassword: string, storedPassword?: string) {
  if (!storedPassword) return false;

  if (storedPassword.startsWith('$2')) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
}

export async function createDataStore() {
  const client = assertSupabaseClient();

  const seedIfNeeded = async () => {
    const [
      { data: existingUsers, error: usersQueryError },
      { data: existingProducts, error: productsQueryError },
    ] = await Promise.all([
      client.from('users').select('id').limit(1),
      client.from('products').select('id').limit(1),
    ]);
    if (usersQueryError) throw usersQueryError;
    if (productsQueryError) throw productsQueryError;

    const adminPasswordHash = bcrypt.hashSync('admin', 12);
    const customerPasswordHash = bcrypt.hashSync('customer123', 12);

    if (!existingUsers?.length) {
      const { error } = await client.from('users').insert([
        {
          id: 'user_1',
          name: 'Admin',
          email: 'admin@joelink.test',
          role: 'admin',
          password: adminPasswordHash,
          wallet_balance: 2500,
          created_at: new Date().toISOString(),
        },
        {
          id: 'user_2',
          name: 'Customer',
          email: 'customer@joelink.test',
          role: 'customer',
          password: customerPasswordHash,
          wallet_balance: 0,
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }

    if (!existingProducts?.length) {
      const { error } = await client.from('products').insert([
        {
          id: '1',
          name: 'Smartphone X',
          price: 799,
          description: 'Flagship device with premium camera and storage.',
          category: 'Phones',
          image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
          stock: 24,
          featured: true,
          credentials: JSON.stringify({ username: 'demo', password: 'demo123' }),
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Wireless Headset',
          price: 199,
          description: 'Immersive sound and active noise cancellation.',
          category: 'Audio',
          image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
          stock: 18,
          featured: true,
          credentials: JSON.stringify({ username: 'audio', password: 'demo123' }),
          created_at: new Date().toISOString(),
        },
      ]);
      if (error) throw error;
    }
  };

  let seedPromise: Promise<void> | undefined;
  const ensureSeeded = () => {
    if (!seedPromise) {
      seedPromise = seedIfNeeded().catch((error: unknown) => {
        seedPromise = undefined;
        throw error;
      });
    }
    return seedPromise;
  };
  const withSeed = <Args extends unknown[], Result>(
    operation: (...args: Args) => Promise<Result>,
  ) => async (...args: Args): Promise<Result> => {
    await ensureSeeded();
    return operation(...args);
  };

  const listProducts = async () => {
    const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: toStringValue(row.id),
      name: toStringValue(row.name),
      price: toNumber(row.price),
      description: toStringValue(row.description),
      category: toStringValue(row.category, 'General'),
      image: toStringValue(row.image),
      stock: toNumber(row.stock),
      featured: Boolean(row.featured),
      credentials: parseCredentials(row.credentials),
    })) as Product[];
  };

  const getProduct = async (id: string) => {
    const { data, error } = await client.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: toStringValue(data.id),
      name: toStringValue(data.name),
      price: toNumber(data.price),
      description: toStringValue(data.description),
      category: toStringValue(data.category, 'General'),
      image: toStringValue(data.image),
      stock: toNumber(data.stock),
      featured: Boolean(data.featured),
      credentials: parseCredentials(data.credentials),
    } as Product;
  };

  const createProduct = async (input: Partial<Product> & { credentials?: Partial<Product['credentials']> }) => {
    const id = input.id !== undefined && input.id !== null ? String(input.id) : String(Date.now());
    const product: Product = {
      id,
      name: input.name || 'Untitled product',
      price: input.price || 0,
      description: input.description || '',
      category: input.category || 'General',
      image: input.image || '',
      stock: input.stock || 0,
      featured: Boolean(input.featured),
      credentials: input.credentials ? {
        username: input.credentials.username || '',
        password: input.credentials.password || '',
        email: input.credentials.email || '',
        recoveryEmail: input.credentials.recoveryEmail || '',
        notes: input.credentials.notes || '',
      } : undefined,
    };

    const { error } = await client.from('products').insert([
      {
        id: product.id,
        name: product.name,
        price: product.price,
        description: product.description,
        category: product.category,
        image: product.image,
        stock: product.stock,
        featured: product.featured,
        credentials: serializeCredentials(product.credentials),
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
    return product;
  };

  const updateProduct = async (id: string, input: Partial<Product> & { credentials?: Partial<Product['credentials']> }) => {
    const existing = await getProduct(id);
    if (!existing) return null;

    const nextProduct = {
      ...existing,
      ...input,
      credentials: input.credentials ? { ...existing.credentials, ...input.credentials } : existing.credentials,
    } as Product;

    const { error } = await client.from('products').update({
      name: nextProduct.name,
      price: nextProduct.price,
      description: nextProduct.description,
      category: nextProduct.category,
      image: nextProduct.image,
      stock: nextProduct.stock,
      featured: nextProduct.featured,
      credentials: serializeCredentials(nextProduct.credentials),
    }).eq('id', id);

    if (error) throw error;
    return nextProduct;
  };

  const deleteProduct = async (id: string) => {
    const { error } = await client.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
  };

  const listUsers = async () => {
    const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: toStringValue(row.id),
      name: toStringValue(row.name),
      email: toStringValue(row.email),
      role: toStringValue(row.role) as 'admin' | 'customer',
      password: typeof row.password === 'string' ? row.password : undefined,
      walletBalance: toNumber(row.wallet_balance),
      createdAt: toStringValue(row.created_at),
    })) as User[];
  };

  const getUser = async (id: string) => {
    const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      id: toStringValue(data.id),
      name: toStringValue(data.name),
      email: toStringValue(data.email),
      role: toStringValue(data.role) as 'admin' | 'customer',
      password: typeof data.password === 'string' ? data.password : undefined,
      walletBalance: toNumber(data.wallet_balance),
      createdAt: toStringValue(data.created_at),
    } as User;
  };

  const createUser = async (input: Partial<User>) => {
    const id = input.id || `user_${Date.now()}`;
    const user: User = {
      id,
      name: input.name || 'Customer',
      email: input.email || 'customer@example.com',
      role: input.role || 'customer',
      password: input.password,
      walletBalance: input.walletBalance || 0,
      createdAt: new Date().toISOString(),
    };

    const { error } = await client.from('users').insert([
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        password: user.password || null,
        wallet_balance: user.walletBalance,
        created_at: user.createdAt,
      },
    ]);

    if (error) throw error;
    return user;
  };

  const updateUser = async (id: string, input: Partial<User>) => {
    const existing = await getUser(id);
    if (!existing) return null;

    const nextUser = {
      ...existing,
      ...input,
      password: input.password !== undefined ? input.password : existing.password,
    } as User;

    const { error } = await client.from('users').update({
      name: nextUser.name,
      email: nextUser.email,
      role: nextUser.role,
      password: nextUser.password || null,
      wallet_balance: nextUser.walletBalance,
    }).eq('id', id);

    if (error) throw error;
    return nextUser;
  };

  const deleteUser = async (id: string) => {
    const { error } = await client.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  };

  const listOrders = async () => {
    const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: toStringValue(row.id),
      userId: toStringValue(row.user_id),
      productId: toStringValue(row.product_id),
      amount: toNumber(row.amount),
      status: toStringValue(row.status) as Order['status'],
      createdAt: toStringValue(row.created_at),
    })) as Order[];
  };

  const createOrder = async (input: Partial<Order>) => {
    const order: Order = {
      id: input.id || `order_${Date.now()}`,
      userId: input.userId || 'user_2',
      productId: input.productId || 'prod_1',
      amount: input.amount || 0,
      status: input.status || 'completed',
      createdAt: new Date().toISOString(),
    };

    const { error } = await client.from('orders').insert([
      {
        id: order.id,
        user_id: order.userId,
        product_id: order.productId,
        amount: order.amount,
        status: order.status,
        created_at: order.createdAt,
      },
    ]);

    if (error) throw error;
    return order;
  };

  const listWalletTransactions = async (userId?: string, type?: string) => {
    let query = client.from('wallet_transactions').select('*').order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: toStringValue(row.id),
      userId: toStringValue(row.user_id),
      type: toStringValue(row.type) as WalletTransaction['type'],
      amount: toNumber(row.amount),
      description: toStringValue(row.description),
      createdAt: toStringValue(row.created_at),
    })) as WalletTransaction[];
  };

  const createWalletTransaction = async (input: Partial<WalletTransaction>) => {
    const transaction: WalletTransaction = {
      id: input.id || `tx_${Date.now()}`,
      userId: input.userId || 'user_2',
      type: input.type || 'deposit',
      amount: input.amount || 0,
      description: input.description || 'Wallet update',
      createdAt: new Date().toISOString(),
    };

    const { error } = await client.from('wallet_transactions').insert([
      {
        id: transaction.id,
        user_id: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        created_at: transaction.createdAt,
      },
    ]);

    if (error) throw error;
    return transaction;
  };

  const listNotifications = async (userId?: string) => {
    const { data, error } = await client.from('notifications').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const filtered = (data ?? []).filter((row) => !userId || toStringValue(row.user_id) === userId || toStringValue(row.user_id) === 'all');
    return filtered.map((row) => ({
      id: toStringValue(row.id),
      userId: toStringValue(row.user_id),
      type: toStringValue(row.type),
      title: toStringValue(row.title),
      message: toStringValue(row.message),
      createdAt: toStringValue(row.created_at),
    })) as Notification[];
  };

  const createNotification = async (input: Partial<Notification>) => {
    const notification: Notification = {
      id: input.id || `notif_${Date.now()}`,
      userId: input.userId || 'all',
      type: input.type || 'info',
      title: input.title || 'New activity',
      message: input.message || 'A new activity was logged.',
      createdAt: new Date().toISOString(),
    };

    const { error } = await client.from('notifications').insert([
      {
        id: notification.id,
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        created_at: notification.createdAt,
      },
    ]);

    if (error) throw error;
    return notification;
  };

  const getAdminStats = async () => {
    const [products, users, orders, walletTransactions, notifications] = await Promise.all([
      listProducts(),
      listUsers(),
      listOrders(),
      listWalletTransactions(),
      listNotifications(),
    ]);

    const totalSales = orders.reduce((sum, order) => sum + order.amount, 0);
    const totalDeposits = walletTransactions.filter((tx) => tx.type === 'deposit').reduce((sum, tx) => sum + tx.amount, 0);
    const activeUserIds = new Set<string>();
    orders.forEach((order) => activeUserIds.add(order.userId));
    walletTransactions.forEach((tx) => activeUserIds.add(tx.userId));

    return {
      products: products.length,
      users: users.length,
      activeUsers: activeUserIds.size,
      orders: orders.length,
      totalSales,
      totalDeposits,
      walletTransactions: walletTransactions.length,
      notifications: notifications.length,
    };
  };

  return {
    listProducts: withSeed(listProducts),
    getProduct: withSeed(getProduct),
    createProduct: withSeed(createProduct),
    updateProduct: withSeed(updateProduct),
    deleteProduct: withSeed(deleteProduct),
    listUsers: withSeed(listUsers),
    getUser: withSeed(getUser),
    createUser: withSeed(createUser),
    updateUser: withSeed(updateUser),
    deleteUser: withSeed(deleteUser),
    listOrders: withSeed(listOrders),
    createOrder: withSeed(createOrder),
    listWalletTransactions: withSeed(listWalletTransactions),
    createWalletTransaction: withSeed(createWalletTransaction),
    listNotifications: withSeed(listNotifications),
    createNotification: withSeed(createNotification),
    getAdminStats: withSeed(getAdminStats),
  };
}

export type { Product, User, Order, WalletTransaction, Notification };
