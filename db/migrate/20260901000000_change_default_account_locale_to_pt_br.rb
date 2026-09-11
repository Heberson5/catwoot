class ChangeDefaultAccountLocaleToPtBr < ActiveRecord::Migration[7.1]
  def up
    change_column_default :accounts, :locale, from: 0, to: 16
  end

  def down
    change_column_default :accounts, :locale, from: 16, to: 0
  end
end
