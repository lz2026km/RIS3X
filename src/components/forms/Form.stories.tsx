/**
 * G005 放射RIS系统 v3.0.0 - Forms Story
 * Phase T2-W5: 20+ 业务组件 story
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Form, Card, Space, Button, Divider, Tag } from 'antd';
import {
  AppTextInput,
  AppSearchInput,
  AppTextArea,
  AppNumberField,
  AppSelectField,
  AppDatePicker,
  AppDateRangeField,
  AppTimePicker,
  AppSwitchField,
  AppCheckboxField,
  AppRadioField,
  AppCascaderField,
  AppTreeSelectField,
  AppSlider,
  AppRateField,
  AppColorPickerField,
  AppMentionsField,
  AppAutoCompleteField,
  AppUploadButton,
} from './Form';
import { Input } from 'antd';

const meta: Meta = {
  title: 'Forms/Input Select DatePicker Switch Radio Checkbox',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

const FormDemo = () => {
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      layout="vertical"
      style={{ maxWidth: 800 }}
      onFinish={(values) => { console.log('[Form] submit:', JSON.stringify(values, null, 2)); }}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Card title="文本输入" size="small">
          <Space wrap size="middle" align="start" style={{ width: '100%' }}>
            <Form.Item label="患者姓名" name="name" rules={[{ required: true }]}>
              <AppTextInput placeholder="请输入患者姓名" />
            </Form.Item>
            <Form.Item label="身份证" name="idCard">
              <AppTextInput placeholder="18 位身份证号" maxLength={18} />
            </Form.Item>
            <Form.Item label="电话" name="phone">
              <AppTextInput type="tel" placeholder="11 位手机号" />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <AppTextInput type="email" placeholder="email@example.com" />
            </Form.Item>
          </Space>
        </Card>

        <Card title="搜索 + 数字" size="small">
          <Space wrap size="middle" align="start">
            <Form.Item label="搜索" name="search">
              <AppSearchInput placeholder="搜索报告/患者" />
            </Form.Item>
            <Form.Item label="检查时长" name="duration">
              <AppNumberField min={1} max={120} suffix="分钟" />
            </Form.Item>
            <Form.Item label="评分" name="score">
              <AppNumberField min={0} max={100} step={0.1} precision={1} />
            </Form.Item>
          </Space>
        </Card>

        <Card title="文本域" size="small">
          <Form.Item label="影像所见" name="findings" style={{ marginBottom: 0 }}>
            <AppTextArea
              placeholder="请详细描述影像所见..."
              rows={4}
              showCount
              maxLength={1000}
            />
          </Form.Item>
        </Card>

        <Card title="选择类" size="small">
          <Space wrap size="middle" align="start">
            <Form.Item label="检查设备" name="modality" style={{ minWidth: 200 }}>
              <AppSelectField
                placeholder="选择设备"
                options={[
                  { label: 'CT', value: 'CT' },
                  { label: 'MR', value: 'MR' },
                  { label: 'DR', value: 'DR' },
                  { label: 'DSA', value: 'DSA' },
                  { label: 'MG(乳腺钼靶)', value: 'MG' },
                  { label: 'US(超声)', value: 'US' },
                ]}
              />
            </Form.Item>

            <Form.Item label="检查类型(多选)" name="examTypes" style={{ minWidth: 200 }}>
              <AppSelectField
                mode="multiple"
                placeholder="选择检查类型"
                options={[
                  { label: '平扫', value: 'plain' },
                  { label: '增强', value: 'enhance' },
                  { label: 'CTA', value: 'cta' },
                  { label: '灌注', value: 'perfusion' },
                ]}
              />
            </Form.Item>

            <Form.Item label="优先级" name="priority" style={{ minWidth: 200 }}>
              <AppSelectField
                placeholder="选择优先级"
                options={[
                  { label: <Tag color="green">常规</Tag>, value: 'routine' },
                  { label: <Tag color="orange">紧急</Tag>, value: 'urgent' },
                  { label: <Tag color="red">特急</Tag>, value: 'stat' },
                ]}
              />
            </Form.Item>

            <Form.Item label="身体部位(级联)" name="bodyPart" style={{ minWidth: 200 }}>
              <AppCascaderField
                placeholder="选择部位"
                options={[
                  {
                    value: 'head', label: '头颈',
                    children: [
                      { value: 'brain', label: '脑' },
                      { value: 'eye', label: '眼' },
                      { value: 'thyroid', label: '甲状腺' },
                    ],
                  },
                  {
                    value: 'chest', label: '胸部',
                    children: [
                      { value: 'lung', label: '肺' },
                      { value: 'heart', label: '心脏' },
                      { value: 'breast', label: '乳腺' },
                    ],
                  },
                  {
                    value: 'abdomen', label: '腹部',
                    children: [
                      { value: 'liver', label: '肝' },
                      { value: 'kidney', label: '肾' },
                      { value: 'spleen', label: '脾' },
                    ],
                  },
                ]}
              />
            </Form.Item>

            <Form.Item label="树形选择" name="dept" style={{ minWidth: 200 }}>
              <AppTreeSelectField
                placeholder="选择科室"
                treeData={[
                  {
                    value: 'radiology', title: '放射科',
                    children: [
                      { value: 'ct', title: 'CT 室' },
                      { value: 'mr', title: 'MR 室' },
                      { value: 'xray', title: 'X 光室' },
                    ],
                  },
                ]}
              />
            </Form.Item>
          </Space>
        </Card>

        <Card title="日期 / 时间" size="small">
          <Space wrap size="middle" align="start">
            <Form.Item label="检查日期" name="examDate">
              <AppDatePicker placeholder="选择日期" />
            </Form.Item>
            <Form.Item label="日期范围" name="dateRange">
              <AppDateRangeField placeholder={['开始日期', '结束日期']} />
            </Form.Item>
            <Form.Item label="检查时间" name="examTime">
              <AppTimePicker placeholder="选择时间" />
            </Form.Item>
          </Space>
        </Card>

        <Card title="开关 / 单选 / 复选" size="small">
          <Space wrap size="middle" align="start">
            <Form.Item label="启用 AI 辅助" name="aiEnabled" valuePropName="checked">
              <AppSwitchField />
            </Form.Item>
            <Form.Item label="性别" name="gender">
              <AppRadioField
                options={[
                  { label: '男', value: 'male' },
                  { label: '女', value: 'female' },
                  { label: '其他', value: 'other' },
                ]}
              />
            </Form.Item>
            <Form.Item label="同意协议" name="agree" valuePropName="checked">
              <AppCheckboxField>我已阅读并同意患者数据处理协议</AppCheckboxField>
            </Form.Item>
          </Space>
        </Card>

        <Card title="滑块 / 评分 / 颜色" size="small">
          <Space wrap size="middle" align="start" style={{ width: '100%' }}>
            <Form.Item label="质量评分" name="quality" style={{ minWidth: 300 }}>
              <AppSlider min={0} max={100} />
            </Form.Item>
            <Form.Item label="满意程度" name="satisfaction">
              <AppRateField />
            </Form.Item>
            <Form.Item label="主题色" name="themeColor">
              <AppColorPickerField defaultValue="#1e40af" showText />
            </Form.Item>
          </Space>
        </Card>

        <Card title="@提及 + 自动完成" size="small">
          <Space wrap size="middle" align="start" style={{ width: '100%' }}>
            <Form.Item label="协作医生" name="collaborators" style={{ minWidth: 300, flex: 1 }}>
              <AppMentionsField
                placeholder="输入 @ 提及医生"
                options={[
                  { value: 'zhangmy', label: '张明远' },
                  { value: 'lihm', label: '李慧敏' },
                  { value: 'wangjh', label: '王建华' },
                ]}
              />
            </Form.Item>
            <Form.Item label="搜索建议" name="suggest" style={{ minWidth: 300, flex: 1 }}>
              <AppAutoCompleteField
                placeholder="输入关键字"
                options={[
                  { value: '肺结节' },
                  { value: '主动脉夹层' },
                  { value: '脑出血' },
                  { value: '心肌梗死' },
                ]}
              />
            </Form.Item>
          </Space>
        </Card>

        <Card title="文件上传" size="small">
          <AppUploadButton
            accept="image/*,.pdf,.dcm"
            multiple
            onUpload={(files) => { console.log(`[Upload] 上传 ${files.length} 个文件`); }}
          >
            上传 DICOM 影像或报告
          </AppUploadButton>
        </Card>
      </Space>

      <Divider />
      <Space>
        <Button type="primary" htmlType="submit" size="large">
          提交
        </Button>
        <Button htmlType="reset" size="large">
          重置
        </Button>
      </Space>
    </Form>
  );
};

export const FormBasic: Story = {
  render: () => <FormDemo />,
};

// 单独展示
export const TextInputBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle" style={{ width: 400 }}>
      <AppTextInput placeholder="基础输入" />
      <AppTextInput placeholder="带前缀" prefix="@" />
      <AppTextInput placeholder="带后缀" suffix=".com" />
      <AppTextInput placeholder="允许清除" allowClear />
      <Input.Password placeholder="密码" />
      <AppTextInput placeholder="禁用" disabled />
    </Space>
  ),
};

export const NumberFieldBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle" style={{ width: 300 }}>
      <AppNumberField placeholder="整数" min={0} max={100} />
      <AppNumberField placeholder="小数" min={0} max={100} step={0.01} precision={2} />
      <AppNumberField placeholder="带前缀" prefix="¥" min={0} />
      <AppNumberField placeholder="带后缀" suffix="mg" min={0} />
    </Space>
  ),
};

export const SwitchBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle">
      <AppSwitchField />
      <AppSwitchField defaultChecked checkedChildren="开" unCheckedChildren="关" />
      <AppSwitchField loading />
      <AppSwitchField disabled />
    </Space>
  ),
};

export const SliderBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle" style={{ width: 400 }}>
      <AppSlider defaultValue={30} />
      <AppSlider defaultValue={[20, 60]} range />
      <AppSlider defaultValue={30} marks={{ 0: '0°C', 26: '26°C', 37: '37°C', 100: { style: { color: '#f50' }, label: <strong>100°C</strong> } }} />
    </Space>
  ),
};

export const ColorPickerBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle">
      <AppColorPickerField defaultValue="#1e40af" />
      <AppColorPickerField defaultValue="#10b981" showText />
    </Space>
  ),
};

export const RateBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle">
      <AppRateField defaultValue={3} />
      <AppRateField defaultValue={3.5} allowHalf />
      <AppRateField count={10} defaultValue={7} />
    </Space>
  ),
};
