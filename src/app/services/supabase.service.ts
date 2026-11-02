import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://jvvidkrwrqhlshnpufdd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_M44OcaVK3zxBqdy1Sj4SzQ_0FHQCzU5';

let globalClient: SupabaseClient | null = null;

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  get client(): SupabaseClient {
    if (!globalClient) {
      globalClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: this.isBrowser,
          autoRefreshToken: this.isBrowser,
        },
      });
    }
    return globalClient;
  }

  getAuthenticatedClient(accessToken?: string): SupabaseClient {
    if (!accessToken) {
      return this.client;
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  // =========================================================================
  // Tenants & Branding Operations
  // =========================================================================
  async getTenants(): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.warn('Supabase: getTenants notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getTenants network exception:', e);
      return [];
    }
  }

  async upsertTenant(tenant: {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    subscription_tier?: string;
    branding?: Record<string, any>;
    settings?: Record<string, any>;
  }): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('tenants')
        .upsert(tenant, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: upsertTenant exception:', e);
      return null;
    }
  }

  async deleteTenant(tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('tenants').delete().eq('id', tenantId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('Supabase: deleteTenant exception:', e);
      return false;
    }
  }

  // =========================================================================
  // Immutable Audit Logs Operations
  // =========================================================================
  async getAuditLogs(tenantId?: string, limit: number = 100): Promise<any[]> {
    try {
      let query = this.client
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getAuditLogs notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getAuditLogs network exception:', e);
      return [];
    }
  }

  async insertAuditLog(log: {
    tenant_id?: string;
    actor_id?: string;
    actor_email?: string;
    action: string;
    target_type: string;
    target_id?: string;
    ip_address?: string;
    user_agent?: string;
    severity?: string;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const { error } = await this.client.from('audit_logs').insert([log]);
      if (error) {
        console.warn('Supabase: insertAuditLog notice:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase: insertAuditLog network exception:', e);
      return false;
    }
  }

  // =========================================================================
  // Directory Groups Operations
  // =========================================================================
  async getDirectoryGroups(tenantId?: string): Promise<any[]> {
    try {
      let query = this.client.from('directory_groups').select('*').order('created_at', { ascending: true });
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getDirectoryGroups notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getDirectoryGroups exception:', e);
      return [];
    }
  }

  async upsertDirectoryGroup(group: {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    department?: string;
    email?: string;
    member_ids?: string[];
    app_ids?: string[];
    policy?: Record<string, any>;
  }): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('directory_groups')
        .upsert(group, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: upsertDirectoryGroup exception:', e);
      return null;
    }
  }

  async deleteDirectoryGroup(groupId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('directory_groups').delete().eq('id', groupId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('Supabase: deleteDirectoryGroup exception:', e);
      return false;
    }
  }

  // =========================================================================
  // Webhook Endpoints & Deliveries Operations
  // =========================================================================
  async getWebhookEndpoints(tenantId?: string): Promise<any[]> {
    try {
      let query = this.client.from('webhook_endpoints').select('*').order('created_at', { ascending: false });
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getWebhookEndpoints notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getWebhookEndpoints exception:', e);
      return [];
    }
  }

  async upsertWebhookEndpoint(endpoint: {
    id: string;
    tenant_id: string;
    url: string;
    description?: string;
    events: string[];
    signing_secret: string;
    is_active: boolean;
    last_status?: string;
    last_status_code?: number;
    last_delivery_at?: string;
    success_count?: number;
    failure_count?: number;
  }): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('webhook_endpoints')
        .upsert(endpoint, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: upsertWebhookEndpoint exception:', e);
      return null;
    }
  }

  async deleteWebhookEndpoint(endpointId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('webhook_endpoints').delete().eq('id', endpointId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('Supabase: deleteWebhookEndpoint exception:', e);
      return false;
    }
  }

  async getWebhookDeliveries(tenantId?: string, limit: number = 50): Promise<any[]> {
    try {
      let query = this.client
        .from('webhook_deliveries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getWebhookDeliveries notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getWebhookDeliveries exception:', e);
      return [];
    }
  }

  async insertWebhookDelivery(delivery: {
    id: string;
    tenant_id: string;
    endpoint_id?: string;
    url: string;
    event: string;
    status: string;
    status_code: number;
    status_text?: string;
    latency_ms: number;
    attempts: number;
    request_headers?: Record<string, any>;
    request_payload: Record<string, any>;
    response_headers?: Record<string, any>;
    response_body?: string;
    signature?: string;
    is_test?: boolean;
  }): Promise<boolean> {
    try {
      const { error } = await this.client.from('webhook_deliveries').insert([delivery]);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('Supabase: insertWebhookDelivery exception:', e);
      return false;
    }
  }

  // =========================================================================
  // User Assigned Apps Operations
  // =========================================================================
  async getUserAssignedApps(userId?: string, tenantId?: string): Promise<any[]> {
    try {
      let query = this.client.from('user_assigned_apps').select('*');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getUserAssignedApps notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getUserAssignedApps exception:', e);
      return [];
    }
  }

  async upsertUserAssignedApp(assignment: {
    id?: string;
    tenant_id: string;
    user_id: string;
    app_id: string;
    name: string;
    protocol?: string;
    launch_url?: string;
    category?: string;
    icon?: string;
    assigned?: boolean;
    inherited_via_group?: string;
  }): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('user_assigned_apps')
        .upsert(assignment, { onConflict: 'tenant_id,user_id,app_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: upsertUserAssignedApp exception:', e);
      return null;
    }
  }

  // =========================================================================
  // Access Requests Operations (SCRUM-42)
  // =========================================================================
  async getAccessRequests(tenantId?: string): Promise<any[]> {
    try {
      let query = this.client.from('access_requests').select('*').order('created_at', { ascending: false });
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getAccessRequests notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getAccessRequests exception:', e);
      return [];
    }
  }

  async createAccessRequest(request: any): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('access_requests')
        .insert(request)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: createAccessRequest exception:', e);
      return null;
    }
  }

  async updateAccessRequestStatus(id: string, status: string, notes?: string, reviewer?: string): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('access_requests')
        .update({
          status,
          admin_notes: notes,
          reviewed_by: reviewer,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: updateAccessRequestStatus exception:', e);
      return null;
    }
  }

  // =========================================================================
  // Managed Endpoint Devices Operations
  // =========================================================================
  async getUserDevices(tenantId?: string): Promise<any[]> {
    try {
      let query = this.client.from('user_devices').select('*').order('enrolled_at', { ascending: false });
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase: getUserDevices notice:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Supabase: getUserDevices exception:', e);
      return [];
    }
  }

  async upsertUserDevice(device: any): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('user_devices')
        .upsert(device, { onConflict: 'id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('Supabase: upsertUserDevice exception:', e);
      return null;
    }
  }

  async deleteUserDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await this.client.from('user_devices').delete().eq('id', deviceId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('Supabase: deleteUserDevice exception:', e);
      return false;
    }
  }
}

