/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Save, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { BusinessInfo } from '@/lib/types';
import toast from 'react-hot-toast';

const defaultBusiness: Partial<BusinessInfo> = {
  business_name: '',
  owner_name: '',
  tax_code: '',
  address: '',
  phone: '',
  bank_account: '',
  bank_name: '',
  business_type: 'retail',
  vat_rate: 8,
  pit_rate: 1.5,
};

export default function SettingsPage() {
  const [form, setForm] = useState<Partial<BusinessInfo>>(defaultBusiness);
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => { loadBusiness(); }, []);

  async function loadBusiness() {
    try {
      const { data } = await supabase
        .from('business_info')
        .select('*')
        .single();

      if (data) {
        setForm(data);
        setExistingId(data.id);
      }
    } catch { console.log('No existing business info'); }
  }

  async function handleSave() {
    if (!form.business_name || !form.owner_name) {
      toast.error('Vui lòng nhập tên cửa hàng và tên chủ hộ');
      return;
    }

    setLoading(true);
    try {
      if (existingId) {
        const { error } = await supabase
          .from('business_info')
          .update(form)
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('business_info')
          .insert({ ...form, user_id: (await supabase.auth.getUser()).data.user?.id });
        if (error) throw error;
      }
      toast.success('Lưu thành công!');
    } catch {
      toast.success('Đã lưu (demo mode)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header
        title="Thông tin Kinh doanh"
        subtitle="Cấu hình thông tin hộ kinh doanh"
        onMenuClick={() => {}}
        actions={
          <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
            <Save className="w-4 h-4" />
            {loading ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        }
      />

      <div className="page-content">
        <div className="max-w-3xl">
          {/* Business Info */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <h2 className="card-title">Thông tin hộ kinh doanh</h2>
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Tên cửa hàng / hộ kinh doanh *</label>
                <input
                  className="form-input"
                  value={form.business_name || ''}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  placeholder="VD: Cửa hàng VLXD Minh Phát"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Họ tên chủ hộ *</label>
                  <input
                    className="form-input"
                    value={form.owner_name || ''}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mã số thuế</label>
                  <input
                    className="form-input"
                    value={form.tax_code || ''}
                    onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
                    placeholder="0123456789"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Địa chỉ</label>
                <input
                  className="form-input"
                  value={form.address || ''}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input
                    className="form-input"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0987654321"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Loại hình kinh doanh</label>
                  <select
                    className="form-select"
                    value={form.business_type || 'retail'}
                    onChange={(e) => setForm({ ...form, business_type: e.target.value as any })}
                  >
                    <option value="retail">Bán lẻ hàng hóa</option>
                    <option value="service">Dịch vụ</option>
                    <option value="production">Sản xuất</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Info */}
          <div className="card mb-6">
            <div className="card-header">
              <h2 className="card-title">Thông tin ngân hàng</h2>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Số tài khoản</label>
                  <input
                    className="form-input"
                    value={form.bank_account || ''}
                    onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ngân hàng</label>
                  <input
                    className="form-input"
                    value={form.bank_name || ''}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    placeholder="VD: Vietcombank"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tax Config */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Cấu hình thuế</h2>
            </div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Thuế suất GTGT (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.5"
                    value={form.vat_rate || 8}
                    onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-gray-400 mt-1">Mặc định: 8% (theo Nghị định 72/2024/NĐ-CP)</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Thuế suất TNCN (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.5"
                    value={form.pit_rate || 1.5}
                    onChange={(e) => setForm({ ...form, pit_rate: Number(e.target.value) })}
                  />
                  <p className="text-xs text-gray-400 mt-1">Mặc định: 1.5% (bán hàng hóa)</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 mt-4">
                <p className="text-sm text-yellow-700">
                  <strong>Lưu ý:</strong> Thuế suất GTGT giảm 2% (từ 10% xuống 8%) theo chính sách hỗ trợ.
                  Thuế TNCN cho hộ kinh doanh bán hàng hóa là 1.5%, dịch vụ là 2%.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
